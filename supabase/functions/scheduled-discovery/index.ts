import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { RemoteOkProvider } from '../_shared/discovery.ts'
import { effectiveSourceRequestLimits } from '../_shared/sourcePolicy.ts'
import { buildSuggestedQuery } from '../_shared/query.ts'
import { scheduledRemoteOkPayload } from '../_shared/scheduledDiscovery.ts'

const remoteOk = new RemoteOkProvider()
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

function sameSecret(actual: string | null, expected: string): boolean {
  if (!actual || actual.length !== expected.length) return false
  let difference = 0
  for (let index = 0; index < expected.length; index++) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index)
  return difference === 0
}

async function setRunStatus(client: ReturnType<typeof createClient>, runId: string, status: string, fields: Record<string, unknown> = {}) {
  const { error } = await client.from('search_runs').update({ status, ...fields }).eq('id', runId)
  if (error) throw new Error('scheduled_run_status_failed')
}

Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const projectUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const schedulerSecret = Deno.env.get('SCHEDULED_DISCOVERY_SECRET')
  if (!projectUrl || !serviceRoleKey || !schedulerSecret) return json({ error: 'scheduler_not_configured' }, 503)

  const authorization = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? null
  if (!sameSecret(authorization, serviceRoleKey) || !sameSecret(request.headers.get('x-scheduler-secret'), schedulerSecret)) {
    return json({ error: 'unauthorized' }, 401)
  }
  const privileged = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const report = async (status: 'running' | 'succeeded' | 'failed' | 'skipped', counts = { claimed: 0, completed: 0, failed: 0 }, errorCode: string | null = null) => {
    const { error } = await privileged.rpc('record_scheduled_worker_health', {
      p_status: status,
      p_claimed: counts.claimed,
      p_completed: counts.completed,
      p_failed: counts.failed,
      p_error_code: errorCode,
    })
    return !error
  }
  if (Deno.env.get('REMOTE_OK_ENABLED') !== 'true') {
    const recorded = await report('skipped', undefined, 'provider_disabled')
    return json({ error: recorded ? 'provider_disabled' : 'worker_health_unavailable' }, 503)
  }
  const globalLimitSetting = Deno.env.get('REMOTE_OK_MONTHLY_LIMIT') ?? ''
  if (!/^\d+$/.test(globalLimitSetting)) {
    const recorded = await report('failed', undefined, 'provider_limit_not_configured')
    return json({ error: recorded ? 'provider_not_configured' : 'worker_health_unavailable' }, 503)
  }
  const globalLimit = Number(globalLimitSetting)
  if (!Number.isSafeInteger(globalLimit) || globalLimit < 1 || globalLimit > 1000000) {
    const recorded = await report('failed', undefined, 'provider_limit_invalid')
    return json({ error: recorded ? 'provider_not_configured' : 'worker_health_unavailable' }, 503)
  }

  if (!await report('running')) return json({ error: 'worker_health_unavailable' }, 503)
  const { data: sources, error: claimError } = await privileged.rpc('claim_scheduled_remote_ok_sources', { p_batch_size: 3 })
  if (claimError) {
    await report('failed', undefined, 'schedule_claim_failed')
    return json({ error: 'schedule_claim_failed' }, 503)
  }

  let completed = 0
  let failed = 0
  let skipped = 0
  for (const source of sources ?? []) {
    const finish = async (success: boolean, code: string | null = null) => {
      const { data, error } = await privileged.rpc('finish_scheduled_remote_ok_source', {
        p_source_id: source.claimed_source_id,
        p_success: success,
        p_error_code: code,
      })
      if (error || data !== true) throw new Error('scheduled_lease_finish_failed')
    }
    const config = source.source_config && typeof source.source_config === 'object' ? source.source_config as Record<string, unknown> : {}
    const limits = effectiveSourceRequestLimits(true, config, globalLimit, Date.now(), false)
    const query = buildSuggestedQuery(source.skills ?? [], source.services ?? [], source.markets ?? [])
    if (!limits || !query) {
      await finish(false, !limits ? 'approval_or_limit_invalid' : 'profile_search_terms_missing')
      failed++
      continue
    }

    const { data: run, error: runError } = await privileged.from('search_runs').insert({
      owner_id: source.owner_id,
      source_id: source.claimed_source_id,
      query,
      status: 'queued',
      idempotency_key: `scheduled/remote-ok/${source.claimed_source_id}/${crypto.randomUUID()}`,
    }).select('id').single()
    if (runError || !run) {
      await finish(false, 'scheduled_run_creation_failed')
      failed++
      continue
    }

    const { data: allowed, error: quotaError } = await privileged.rpc('reserve_discovery_slot', {
      p_owner: source.owner_id,
      p_run_id: run.id,
      p_owner_monthly_limit: limits.ownerMonthlyLimit,
      p_global_monthly_limit: limits.globalMonthlyLimit,
    })
    if (quotaError) {
      await setRunStatus(privileged, run.id, 'failed', { error_code: 'quota_check_failed', finished_at: new Date().toISOString() })
      await finish(false, 'quota_check_failed')
      failed++
      continue
    }
    if (!allowed) {
      await setRunStatus(privileged, run.id, 'cancelled', { error_code: 'monthly_limit', finished_at: new Date().toISOString() })
      // A reached monthly cap is an expected pause, not a transient retry.
      await finish(true)
      skipped++
      continue
    }

    const startedAt = new Date().toISOString()
    await setRunStatus(privileged, run.id, 'running', { started_at: startedAt })
    try {
      const results = await remoteOk.search({ query, country: 'US', count: 10 })
      const payload = scheduledRemoteOkPayload(results, { skills: source.skills ?? [], services: source.services ?? [] })
      const { data: inserted, error: persistError } = await privileged.rpc('persist_scheduled_remote_ok_results', {
        p_owner: source.owner_id,
        p_source_id: source.claimed_source_id,
        p_run_id: run.id,
        p_results: payload,
      })
      if (persistError) throw new Error('scheduled_persistence_failed')
      await setRunStatus(privileged, run.id, 'completed', { result_count: payload.length, finished_at: new Date().toISOString() })
      await finish(true)
      completed++
      // Keep the response aggregate-only; never return account profiles or leads.
      skipped += Math.max(0, payload.length - Number(inserted ?? 0))
    } catch {
      await setRunStatus(privileged, run.id, 'failed', {
        error_code: 'scheduled_run_failed',
        error_summary: 'Provider or persistence failed; a bounded retry is scheduled.',
        finished_at: new Date().toISOString(),
      })
      await finish(false, 'scheduled_run_failed')
      failed++
    }
  }

  const claimed = (sources ?? []).length
  const healthRecorded = await report(failed > 0 ? 'failed' : 'succeeded', { claimed, completed, failed }, failed > 0 ? 'source_run_failed' : null)
  if (!healthRecorded) return json({ error: 'worker_health_unavailable' }, 503)
  return json({ claimed, completed, failed, skipped })
})

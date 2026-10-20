// Public web discovery adapter. The Brave API key stays in Edge Function secrets.
// Deploy with: supabase functions deploy discover
// Configure: supabase secrets set BRAVE_SEARCH_API_KEY=...
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BraveSearchProvider } from '../_shared/discovery.ts'
import { effectiveSourceRequestLimits } from '../_shared/sourcePolicy.ts'

const provider = new BraveSearchProvider()

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  const projectUrl = Deno.env.get('SUPABASE_URL'), anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!token || !projectUrl || !anonKey || !serviceRoleKey) return json({ error: 'unauthorized' }, 401)
  const supabase = createClient(projectUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const privileged = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return json({ error: 'unauthorized' }, 401)

  let payload: { query?: unknown; country?: unknown; count?: unknown; kind?: unknown }
  try { payload = await request.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const rawQuery = typeof payload.query === 'string' ? payload.query.trim() : ''
  const kind = payload.kind === 'company' ? 'company' : 'opportunity'
  const intent = kind === 'company' ? ' company business' : ' job contract freelance'
  const query = `${rawQuery}${intent}`
  if (!rawQuery || query.length > 600 || query.split(/\s+/).length > 75) return json({ error: 'invalid_query' }, 400)
  const country = typeof payload.country === 'string' && /^[A-Za-z]{2}$/.test(payload.country) ? payload.country.toUpperCase() : 'NG'
  const count = typeof payload.count === 'number' && Number.isInteger(payload.count) ? Math.min(20, Math.max(1, payload.count)) : 10
  const apiKey = Deno.env.get('BRAVE_SEARCH_API_KEY')
  const enabled = Deno.env.get('BRAVE_SEARCH_ENABLED') === 'true'
  const storageRightsConfirmed = Deno.env.get('BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED') === 'true'
  const monthlyLimit = Number.parseInt(Deno.env.get('BRAVE_SEARCH_MONTHLY_LIMIT') ?? '', 10)
  if (!enabled || !storageRightsConfirmed || !apiKey || !Number.isSafeInteger(monthlyLimit) || monthlyLimit < 1) return json({ error: 'provider_not_configured_or_disabled' }, 503)

  const { data: source, error: sourceError } = await supabase.from('discovery_sources')
    .select('id,enabled,config').eq('owner_id',user.id).eq('kind','search_api').eq('name',provider.name).maybeSingle()
  if (sourceError) return json({ error: 'source_registry_unavailable' }, 503)
  const limits = effectiveSourceRequestLimits(Boolean(source?.enabled), source?.config, monthlyLimit)
  if (limits === null) return json({ error: 'source_not_approved_by_owner' }, 403)

  const idempotencyKey = request.headers.get('Idempotency-Key')?.slice(0, 120) || crypto.randomUUID()
  const { data: run, error: runError } = await supabase.from('search_runs').insert({ owner_id: user.id, source_id:source.id, query, status: 'queued', idempotency_key: idempotencyKey }).select('id').single()
  if (runError) return json({ error: runError.code === '23505' ? 'duplicate_request' : 'run_creation_failed' }, runError.code === '23505' ? 409 : 500)
  const { data: allowed, error: limitError } = await privileged.rpc('reserve_discovery_slot', {
    p_owner: user.id,
    p_run_id: run.id,
    p_owner_monthly_limit: limits.ownerMonthlyLimit,
    p_global_monthly_limit: limits.globalMonthlyLimit,
  })
  if (limitError) {
    await supabase.from('search_runs').update({ status: 'failed', error_code: 'quota_check_failed', finished_at: new Date().toISOString() }).eq('id', run.id).eq('owner_id', user.id)
    return json({ error: 'quota_check_failed', run_id: run.id }, 503)
  }
  if (!allowed) {
    await supabase.from('search_runs').update({ status: 'cancelled', error_code: 'monthly_limit', finished_at: new Date().toISOString() }).eq('id', run.id).eq('owner_id', user.id)
    return json({ error: 'monthly_limit_reached' }, 429)
  }
  await supabase.from('search_runs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', run.id).eq('owner_id', user.id)
  try {
    const normalized = await provider.search({ query, country, count }, apiKey)
    await supabase.from('search_runs').update({ status: 'completed', result_count: normalized.length, finished_at: new Date().toISOString() }).eq('id', run.id).eq('owner_id', user.id)
    return json({ run_id: run.id, source_id:source.id, results: normalized })
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 80) : 'provider_error'
    await supabase.from('search_runs').update({ status: 'failed', error_code: 'provider_error', error_summary: code, finished_at: new Date().toISOString() }).eq('id', run.id).eq('owner_id', user.id)
    return json({ error: 'provider_error', run_id: run.id }, 502)
  }
})

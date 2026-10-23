// Scheduled server-side worker. It sends only notifications whose owner opted
// in and whose Supabase Auth email is confirmed. Configure Resend secrets only
// after verifying a sender domain; the function does not send when unconfigured.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { notificationEmail, resendApiKey, retryAt } from '../_shared/emailOutbox.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const workerSecret = Deno.env.get('OUTBOX_WORKER_SECRET')
  if (!workerSecret || request.headers.get('x-worker-secret') !== workerSecret) return json({ error: 'unauthorized' }, 401)

  const projectUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = resendApiKey(name => Deno.env.get(name))
  const emailFrom = Deno.env.get('EMAIL_FROM')
  if (!projectUrl || !serviceRoleKey || !resendKey || !emailFrom) return json({ error: 'email_provider_not_configured' }, 503)

  const supabase = createClient(projectUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: batch, error: claimError } = await supabase.rpc('claim_notification_outbox', { p_batch_size: 20 })
  if (claimError) return json({ error: 'outbox_claim_failed' }, 503)

  let sent = 0, retried = 0, failed = 0
  for (const item of batch ?? []) {
    try {
      const [{ data: profile }, { data: authResult, error: authError }] = await Promise.all([
        supabase.from('profiles').select('email_notifications_enabled').eq('id', item.owner_id).maybeSingle(),
        supabase.auth.admin.getUserById(item.owner_id),
      ])
      const recipient = authResult?.user
      if (!profile?.email_notifications_enabled || !recipient?.email || !recipient.email_confirmed_at) {
        const { error: finishError } = await supabase.rpc('finish_notification_outbox', {
          p_id: item.id,
          p_success: false,
          p_error_code: authError ? 'account_lookup_failed' : 'email_not_enabled_or_unverified',
          p_retry_at: authError ? retryAt(item.attempts) : undefined,
          p_terminal: !authError,
        })
        if (finishError) throw new Error('outbox_finish_failed')
        if (authError && item.attempts < 5) retried++; else failed++
        continue
      }

      const { data: notice, error: noticeError } = await supabase.from('notifications').select('title,body,lead_id').eq('id', item.notification_id).eq('owner_id', item.owner_id).maybeSingle()
      if (noticeError || !notice) throw new Error('notification_lookup_failed')
      const { data: lead } = notice.lead_id
        ? await supabase.from('leads').select('title,organization,score,score_reason,source_url').eq('id', notice.lead_id).eq('owner_id', item.owner_id).maybeSingle()
        : { data: null }
      const content = notificationEmail(notice, lead)
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': item.idempotency_key },
        body: JSON.stringify({ from: emailFrom, to: [recipient.email], subject: content.subject, text: content.text, html: content.html }),
        signal: AbortSignal.timeout(12000),
      })
      if (!response.ok) {
        const terminal = response.status >= 400 && response.status < 500 && response.status !== 429
        const { error: finishError } = await supabase.rpc('finish_notification_outbox', { p_id: item.id, p_success: false, p_error_code: `resend_http_${response.status}`, p_retry_at: retryAt(item.attempts), p_terminal: terminal })
        if (finishError) throw new Error('outbox_finish_failed')
        if (terminal || item.attempts >= 5) failed++; else retried++
        continue
      }
      const { error: finishError } = await supabase.rpc('finish_notification_outbox', { p_id: item.id, p_success: true })
      if (finishError) throw new Error('outbox_finish_failed')
      sent++
    } catch (error) {
      const code = error instanceof Error && error.name === 'TimeoutError' ? 'provider_timeout' : 'email_delivery_error'
      const { error: finishError } = await supabase.rpc('finish_notification_outbox', { p_id: item.id, p_success: false, p_error_code: code, p_retry_at: retryAt(item.attempts) })
      if (finishError || item.attempts >= 5) failed++; else retried++
    }
  }

  return json({ processed: (batch ?? []).length, sent, retried, failed })
})

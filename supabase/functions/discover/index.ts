// Public web discovery adapter. The Brave API key stays in Edge Function secrets.
// Deploy with: supabase functions deploy discover
// Configure: supabase secrets set BRAVE_SEARCH_API_KEY=...
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  if (!token || !projectUrl || !anonKey) return json({ error: 'unauthorized' }, 401)
  const supabase = createClient(projectUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return json({ error: 'unauthorized' }, 401)

  let payload: { query?: unknown; country?: unknown; count?: unknown }
  try { payload = await request.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const query = typeof payload.query === 'string' ? payload.query.trim() : ''
  if (!query || query.length > 600 || query.split(/\s+/).length > 75) return json({ error: 'invalid_query' }, 400)
  const country = typeof payload.country === 'string' && /^[A-Za-z]{2}$/.test(payload.country) ? payload.country.toUpperCase() : 'NG'
  const count = typeof payload.count === 'number' && Number.isInteger(payload.count) ? Math.min(20, Math.max(1, payload.count)) : 10
  const apiKey = Deno.env.get('BRAVE_SEARCH_API_KEY')
  if (!apiKey) return json({ error: 'provider_not_configured' }, 503)

  const idempotencyKey = request.headers.get('Idempotency-Key')?.slice(0, 120) || crypto.randomUUID()
  const { data: run, error: runError } = await supabase.from('search_runs').insert({ owner_id: user.id, query, status: 'running', idempotency_key: idempotencyKey, started_at: new Date().toISOString() }).select('id').single()
  if (runError) return json({ error: runError.code === '23505' ? 'duplicate_request' : 'run_creation_failed' }, runError.code === '23505' ? 409 : 500)
  try {
    const url = new URL('https://api.search.brave.com/res/v1/web/search')
    url.searchParams.set('q', query); url.searchParams.set('country', country); url.searchParams.set('search_lang', 'en'); url.searchParams.set('count', String(count))
    const response = await fetch(url, { headers: { 'X-Subscription-Token': apiKey, 'Accept': 'application/json' }, signal: AbortSignal.timeout(12000) })
    if (!response.ok) throw new Error(`provider_http_${response.status}`)
    const raw = await response.json()
    const results = Array.isArray(raw?.web?.results) ? raw.web.results : []
    const normalized = results.map((item: Record<string, unknown>) => ({
      title: typeof item.title === 'string' ? item.title.slice(0, 300) : 'Untitled result',
      url: safePublicUrl(item.url),
      snippet: typeof item.description === 'string' ? item.description.slice(0, 1500) : '',
      source: 'Brave Search',
    })).filter((item: { url: string | null }) => item.url)
    await supabase.from('search_runs').update({ status: 'completed', result_count: normalized.length, finished_at: new Date().toISOString() }).eq('id', run.id).eq('owner_id', user.id)
    return json({ run_id: run.id, results: normalized })
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 80) : 'provider_error'
    await supabase.from('search_runs').update({ status: 'failed', error_code: 'provider_error', error_summary: code, finished_at: new Date().toISOString() }).eq('id', run.id).eq('owner_id', user.id)
    return json({ error: 'provider_error', run_id: run.id }, 502)
  }
})

function safePublicUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) return null
    if (['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase()) || /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)) return null
    return url.toString()
  } catch { return null }
}

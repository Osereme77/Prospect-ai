import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { discoveryCorsHeaders } from '../_shared/cors.ts'

const cors = (request: Request) => discoveryCorsHeaders(request.headers.get('Origin'), Deno.env.get('APP_ALLOWED_ORIGINS'), Deno.env.get('APP_ORIGIN'))
const json = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors(request), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(request) })
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405)

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  const projectUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!token || !projectUrl || !anonKey || !serviceRoleKey) return json(request, { error: 'unauthorized' }, 401)

  const callerClient = createClient(projectUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const privileged = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user }, error: authError } = await callerClient.auth.getUser(token)
  if (authError || !user) return json(request, { error: 'unauthorized' }, 401)

  const { data: callerRole, error: roleError } = await privileged.from('user_roles')
    .select('role').eq('user_id', user.id).maybeSingle()
  if (roleError) return json(request, { error: 'role_check_failed' }, 503)
  if (callerRole?.role !== 'super_admin') return json(request, { error: 'super_admin_required' }, 403)

  let body: { action?: unknown; user_id?: unknown }
  try { body = await request.json() } catch { return json(request, { error: 'invalid_json' }, 400) }
  const action = body.action

  if (action === 'list') {
    // Keep this endpoint bounded. The response contains account metadata only,
    // never credentials, tokens, or confirmation URLs.
    const perPage = 100
    const maxPages = 5
    const users = []
    for (let page = 1; page <= maxPages; page++) {
      const { data, error } = await privileged.auth.admin.listUsers({ page, perPage })
      if (error) return json(request, { error: 'user_list_failed' }, 503)
      users.push(...data.users)
      if (data.users.length < perPage) break
    }
    const ids = users.map(account => account.id)
    const { data: roles, error: usersRoleError } = ids.length
      ? await privileged.from('user_roles').select('user_id,role').in('user_id', ids)
      : { data: [], error: null }
    if (usersRoleError) return json(request, { error: 'role_list_failed' }, 503)
    const roleById = new Map((roles ?? []).map(row => [row.user_id, row.role]))
    return json(request, {
      users: users.map(account => ({
        id: account.id,
        email: account.email ?? '(no email)',
        created_at: account.created_at,
        last_sign_in_at: account.last_sign_in_at ?? null,
        email_confirmed_at: account.email_confirmed_at ?? null,
        banned_until: account.banned_until ?? null,
        role: roleById.get(account.id) ?? 'user',
      })),
      has_more: users.length === perPage * maxPages,
    })
  }

  if (action !== 'suspend' && action !== 'restore') return json(request, { error: 'invalid_action' }, 400)
  if (typeof body.user_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.user_id)) {
    return json(request, { error: 'invalid_user_id' }, 400)
  }
  if (body.user_id === user.id) return json(request, { error: 'cannot_suspend_self' }, 400)

  const { data: targetRole, error: targetRoleError } = await privileged.from('user_roles')
    .select('role').eq('user_id', body.user_id).maybeSingle()
  if (targetRoleError) return json(request, { error: 'target_role_check_failed' }, 503)
  if (targetRole?.role === 'super_admin') return json(request, { error: 'cannot_manage_super_admin' }, 403)

  const { error: updateError } = await privileged.auth.admin.updateUserById(body.user_id, {
    ban_duration: action === 'suspend' ? '876000h' : 'none',
  })
  if (updateError) return json(request, { error: 'account_update_failed' }, 503)

  const { error: auditError } = await privileged.from('audit_logs').insert({
    actor_id: user.id,
    action: action === 'suspend' ? 'auth_user.suspended' : 'auth_user.restored',
    entity_type: 'auth_user',
    entity_id: body.user_id,
    metadata: { role: targetRole?.role ?? 'user' },
  })
  if (auditError) return json(request, { error: 'audit_write_failed' }, 503)
  return json(request, { success: true })
})

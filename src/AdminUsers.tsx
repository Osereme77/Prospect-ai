import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { RefreshCw, ShieldCheck, UserRoundX, UserRoundCheck } from 'lucide-react'
import { supabase } from './lib/supabase'

interface ManagedUser {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  banned_until: string | null
  role: string
}

interface UserListResponse {
  users: ManagedUser[]
  has_more: boolean
}

export default function AdminUsers({ user, notify }: { user: User; notify: (message: string) => void }) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    if (!supabase) {
      setError('Supabase is not configured for this deployment.')
      setLoading(false)
      return
    }
    supabase.functions.invoke<UserListResponse>('admin-user-management', { body: { action: 'list' } })
      .then(({ data, error: invokeError }) => {
        if (!active) return
        if (invokeError || !data || !Array.isArray(data.users)) {
          setError('Could not load accounts. Confirm the admin-user-management function is deployed, then retry.')
          return
        }
        setUsers(data.users)
        setHasMore(data.has_more)
      })
      .catch(() => { if (active) setError('Could not connect to account management. Check the deployment and retry.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user.id, refresh])

  async function setSuspended(account: ManagedUser, suspend: boolean) {
    if (!supabase) return
    const action = suspend ? 'suspend' : 'restore'
    const verb = suspend ? 'suspend sign-in for' : 'restore sign-in for'
    if (!window.confirm(`Are you sure you want to ${verb} ${account.email}?`)) return
    setBusyId(account.id)
    const { data, error: invokeError } = await supabase.functions.invoke<{ success?: boolean; error?: string }>(
      'admin-user-management', { body: { action, user_id: account.id } },
    )
    if (invokeError || !data?.success) {
      notify(data?.error === 'cannot_manage_super_admin'
        ? 'Super admin accounts cannot be suspended here.'
        : 'Could not update this account. Check the function deployment and your permissions.')
      setBusyId('')
      return
    }
    notify(suspend ? 'Sign-in suspended for this account.' : 'Sign-in restored for this account.')
    setBusyId('')
    setRefresh(value => value + 1)
  }

  return <section className="panel admin-panel admin-users" aria-labelledby="admin-users-title">
    <div className="admin-users-heading">
      <div><h2 id="admin-users-title">Accounts and sign-ins</h2><p>See account email, creation date, and most recent sign-in. Only super admins can suspend or restore sign-in.</p></div>
      <button className="secondary" onClick={() => setRefresh(value => value + 1)} disabled={loading} aria-label="Refresh account list"><RefreshCw size={15} /> Refresh</button>
    </div>
    {loading ? <p role="status">Loading account list…</p>
      : error ? <div role="alert"><p>{error}</p><button className="secondary" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>
      : <><div className="table-wrap"><table><thead><tr><th>ACCOUNT</th><th>ROLE</th><th>CREATED</th><th>LAST SIGN-IN</th><th>EMAIL</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
        {users.length ? users.map(account => {
          const suspended = Boolean(account.banned_until && Date.parse(account.banned_until) > Date.now())
          const protectedAccount = account.id === user.id || account.role === 'super_admin'
          return <tr key={account.id}>
            <td>{account.email}</td><td>{account.role.replace('_', ' ')}</td>
            <td>{new Date(account.created_at).toLocaleDateString()}</td>
            <td>{account.last_sign_in_at ? new Date(account.last_sign_in_at).toLocaleString() : 'Never'}</td>
            <td>{account.email_confirmed_at ? 'Confirmed' : 'Unconfirmed'}</td>
            <td>{suspended ? 'Sign-in suspended' : 'Active'}</td>
            <td>{protectedAccount ? <span className="admin-protected-account"><ShieldCheck size={14} /> Protected</span> : <button className="secondary" disabled={busyId === account.id} onClick={() => void setSuspended(account, !suspended)}>
              {suspended ? <><UserRoundCheck size={14} /> Restore</> : <><UserRoundX size={14} /> Suspend</>}
            </button>}</td>
          </tr>
        }) : <tr><td colSpan={7} className="empty">No accounts found.</td></tr>}
      </tbody></table></div>
      {hasMore && <p className="admin-users-limit" role="status">Showing the first 500 accounts. Use Supabase Auth for accounts beyond this list.</p>}
      <small><ShieldCheck size={13} /> Suspending blocks future sign-ins and refreshes. Existing sessions may stay active until their access token expires.</small></>}
  </section>
}

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Activity, Pause, Play, RefreshCw, ShieldCheck } from 'lucide-react'
import {
  loadAdminOperations,
  requeueFailedNotification,
  setAdminDiscoverySourceEnabled,
  type AdminOperationsData,
} from './lib/repository'
import { getQueueHealthAlerts, getWorkerHealthAlerts } from './lib/operations'

export default function AdminOperations({ user, notify }: { user: User; notify: (message: string) => void }) {
  const [data, setData] = useState<AdminOperationsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    loadAdminOperations(user)
      .then(result => { if (active) setData(result) })
      .catch(() => { if (active) setError('Could not load operational data. Confirm the admin migrations are applied and try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user.id, refresh])

  async function retryNotification(id: string) {
    setBusy(id)
    try {
      const changed = await requeueFailedNotification(id)
      notify(changed ? 'Email job queued for retry.' : 'That job is no longer in the failed state.')
      setRefresh(value => value + 1)
    } catch {
      notify('Could not retry that email job. Check the connection and admin permissions.')
    } finally {
      setBusy('')
    }
  }

  async function toggleSource(id: string, enabled: boolean) {
    setBusy(id)
    try {
      const changed = await setAdminDiscoverySourceEnabled(id, enabled)
      notify(changed ? `Discovery source ${enabled ? 'resumed' : 'paused'}.` : 'The source state was already changed.')
      setRefresh(value => value + 1)
    } catch {
      notify('Could not change that source. Check the connection and admin permissions.')
    } finally {
      setBusy('')
    }
  }

  if (loading) return <section className="panel admin-ops" aria-busy="true"><Activity /><h1>Operations</h1><p>Loading protected operational data…</p></section>
  if (error) return <section className="panel admin-ops" role="alert"><h1>Operations</h1><p>{error}</p><button className="secondary" onClick={() => setRefresh(value => value + 1)}>Retry loading</button></section>
  if (!data) return <section className="panel admin-ops" role="status"><ShieldCheck /><h1>Admin access required</h1><p>This account does not have an administrative role.</p></section>

  const currentMonth = data.usage[0]
  const queueAlerts = getQueueHealthAlerts(data.queueHealth)
  const workerAlerts = getWorkerHealthAlerts(data.workerHealth)
  const stats = [
    ['Sources', data.sources.length],
    ['Search runs', data.runs.length],
    ['Requests this month', currentMonth?.total_requests ?? 0],
    ['Accounts active this month', currentMonth?.active_accounts ?? 0],
    ['Queued email', data.queueHealth.queued_count],
    ['Failed email', data.queueHealth.failed_count],
  ] as const

  return <>
    <small className="eyebrow">PRIVILEGED WORKSPACE</small>
    <h1>Operations</h1>
    <p className="subtitle">Review discovery usage, sources, runs, email delivery, and audit events.</p>
    <button className="secondary admin-refresh" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={15} /> Refresh operational data</button>
    <div className="stats admin-stats">
      {stats.map(([label, value]) => <div className="stat" key={label}><span>{label}</span><Activity size={17} /><b>{value}</b><small>{label.includes('this month') || label.includes('active this month') ? 'Current calendar month' : label.includes('email') ? 'Across the full queue' : 'Latest 50 records where applicable'}</small></div>)}
    </div>
    {queueAlerts.length > 0 && <section className="cloud-error admin-queue-alert" role="alert" aria-label="Email queue needs attention">
      <b>Email queue needs attention</b>
      <ul>{queueAlerts.map(alert => <li key={alert}>{alert}</li>)}</ul>
    </section>}
    {workerAlerts.length > 0 && <section className="cloud-error admin-queue-alert" role="alert" aria-label="Scheduled worker needs attention">
      <b>Scheduled worker needs attention</b>
      <ul>{workerAlerts.map(alert => <li key={alert}>{alert}</li>)}</ul>
    </section>}

    <section className="panel admin-panel">
      <h2>Scheduled worker health</h2>
      <p>Aggregate heartbeat for browser-closed Remote OK discovery. A successful heartbeat confirms the worker ran, not that any result is verified.</p>
      <div className="table-wrap"><table><thead><tr><th>WORKER</th><th>LAST STATUS</th><th>STARTED</th><th>FINISHED</th><th>CLAIMED</th><th>COMPLETED</th><th>FAILED</th><th>LAST ERROR</th></tr></thead><tbody>
        {data.workerHealth.length ? data.workerHealth.map(worker => <tr key={worker.worker}><td>{worker.worker}</td><td>{worker.last_status ?? 'Not run'}</td><td>{worker.last_started_at ? new Date(worker.last_started_at).toLocaleString() : '—'}</td><td>{worker.last_finished_at ? new Date(worker.last_finished_at).toLocaleString() : '—'}</td><td>{worker.last_claimed}</td><td>{worker.last_completed}</td><td>{worker.last_failed}</td><td>{worker.last_error_code ?? '—'}</td></tr>) : <tr><td colSpan={8} className="empty">No scheduled worker health record.</td></tr>}
      </tbody></table></div>
    </section>

    <section className="panel admin-panel">
      <h2>Monthly discovery usage</h2>
      <p>Aggregated provider reservations. The provider cap is configured separately on the server.</p>
      <div className="table-wrap"><table><thead><tr><th>MONTH</th><th>REQUESTS</th><th>ACTIVE ACCOUNTS</th></tr></thead><tbody>
        {data.usage.length ? data.usage.map(month => <tr key={month.month_start}><td>{new Date(`${month.month_start}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</td><td>{month.total_requests}</td><td>{month.active_accounts}</td></tr>) : <tr><td colSpan={3} className="empty">No provider requests have been reserved.</td></tr>}
      </tbody></table></div>
    </section>

    <section className="panel admin-panel">
      <h2>Discovery sources</h2>
      <p>Pausing a source blocks future user discovery requests. Provider enablement, owner consent, and storage rights remain separate requirements.</p>
      <div className="table-wrap"><table><thead><tr><th>SOURCE</th><th>TYPE</th><th>OWNER ID</th><th>STATE</th><th>ACTION</th></tr></thead><tbody>
        {data.sources.length ? data.sources.map(source => <tr key={source.id}><td>{source.name}</td><td>{source.kind}</td><td className="admin-id">{source.owner_id ?? 'Global'}</td><td>{source.enabled ? 'Enabled' : 'Paused'}</td><td><button className="secondary" disabled={busy === source.id} onClick={() => void toggleSource(source.id, !source.enabled)}>{source.enabled ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}</button></td></tr>) : <tr><td colSpan={5} className="empty">No configured sources.</td></tr>}
      </tbody></table></div>
    </section>

    <section className="panel admin-panel">
      <h2>Notification delivery</h2>
      <p>Manual retries keep the same notification and provider idempotency key.</p>
      <div className="table-wrap"><table><thead><tr><th>STATUS</th><th>OWNER ID</th><th>ATTEMPTS</th><th>LAST ERROR</th><th>CREATED</th><th>ACTION</th></tr></thead><tbody>
        {data.outbox.length ? data.outbox.map(item => <tr key={item.id}><td>{item.status}</td><td className="admin-id">{item.owner_id}</td><td>{item.attempts}</td><td>{item.last_error_code ?? '—'}</td><td>{new Date(item.created_at).toLocaleString()}</td><td>{item.status === 'failed' && <button className="secondary" disabled={busy === item.id} onClick={() => void retryNotification(item.id)}>{busy === item.id ? 'Queueing…' : 'Retry'}</button>}</td></tr>) : <tr><td colSpan={6} className="empty">No email outbox records.</td></tr>}
      </tbody></table></div>
    </section>

    <div className="admin-grid">
      <section className="panel admin-panel"><h2>Recent search runs</h2><div className="table-wrap"><table><thead><tr><th>STATUS</th><th>QUERY</th><th>RESULTS</th><th>ERROR</th><th>CREATED</th></tr></thead><tbody>
        {data.runs.length ? data.runs.map(run => <tr key={run.id}><td>{run.status}</td><td>{run.query.slice(0, 100)}</td><td>{run.result_count}</td><td>{run.error_code ?? run.error_summary ?? '—'}</td><td>{new Date(run.created_at).toLocaleString()}</td></tr>) : <tr><td colSpan={5} className="empty">No search runs.</td></tr>}
      </tbody></table></div></section>
      <section className="panel admin-panel"><h2>Audit events</h2><p>Recent administrative actions. Credentials and token values are excluded.</p><div className="table-wrap"><table><thead><tr><th>ACTION</th><th>ENTITY</th><th>ID</th><th>ACTOR</th><th>TIME</th></tr></thead><tbody>
        {data.audit.length ? data.audit.map(item => <tr key={item.id}><td>{item.action}</td><td>{item.entity_type}</td><td className="admin-id">{item.entity_id ?? '—'}</td><td className="admin-id">{item.actor_id ?? 'System'}</td><td>{new Date(item.created_at).toLocaleString()}</td></tr>) : <tr><td colSpan={5} className="empty">No audit events recorded.</td></tr>}
      </tbody></table></div></section>
    </div>
  </>
}

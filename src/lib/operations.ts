export interface AdminQueueHealth {
  queued_count: number
  oldest_queued_at: string | null
  stale_sending_count: number
  failed_count: number
}

const warningAfterMs = 15 * 60 * 1000

export function getQueueHealthAlerts(health: AdminQueueHealth, now = Date.now()): string[] {
  const alerts: string[] = []
  const queued = Number.isFinite(health.queued_count) ? Math.max(0, health.queued_count) : 0
  const staleSending = Number.isFinite(health.stale_sending_count) ? Math.max(0, health.stale_sending_count) : 0
  const failed = Number.isFinite(health.failed_count) ? Math.max(0, health.failed_count) : 0

  if (queued > 0 && health.oldest_queued_at) {
    const oldest = Date.parse(health.oldest_queued_at)
    const age = now - oldest
    if (Number.isFinite(oldest) && age >= warningAfterMs) {
      alerts.push(`The oldest of ${queued} queued email job${queued === 1 ? '' : 's'} has waited ${Math.floor(age / 60_000)} minutes. Check the scheduler and worker configuration.`)
    }
  }

  if (staleSending > 0) {
    alerts.push(`${staleSending} email job${staleSending === 1 ? ' has' : 's have'} a sending lock older than 15 minutes and may need worker recovery.`)
  }

  if (failed > 0) {
    alerts.push(`${failed} email delivery job${failed === 1 ? ' needs' : 's need'} review in Notification delivery.`)
  }

  return alerts
}

export interface ScheduledWorkerHealth {
  worker: string
  last_started_at: string | null
  last_finished_at: string | null
  last_status: string | null
  last_error_code: string | null
  last_claimed: number
  last_completed: number
  last_failed: number
}

const workerStaleAfterMs = 36 * 60 * 60 * 1000
const workerStuckAfterMs = 15 * 60 * 1000

export function getWorkerHealthAlerts(health: ScheduledWorkerHealth[], now = Date.now()): string[] {
  return health.flatMap(worker => {
    const label = worker.worker === 'scheduled-discovery' ? 'Scheduled discovery' : 'A scheduled worker'
    if (!worker.last_finished_at && worker.last_status !== 'running') {
      return [`${label} has not completed a run yet. Configure and verify its scheduler before relying on it.`]
    }
    if (worker.last_status === 'running') {
      const started = worker.last_started_at ? Date.parse(worker.last_started_at) : NaN
      return Number.isFinite(started) && now - started >= workerStuckAfterMs
        ? [`${label} has been running for at least 15 minutes. Check its logs and lease recovery.`]
        : []
    }
    if (worker.last_status === 'failed') {
      return [`${label} last failed${worker.last_error_code ? ` (${worker.last_error_code})` : ''}. Review its logs before retrying.`]
    }
    const finished = Date.parse(worker.last_finished_at ?? '')
    return Number.isFinite(finished) && now - finished >= workerStaleAfterMs
      ? [`${label} has not completed successfully within 36 hours. Check the scheduler configuration and recent runs.`]
      : []
  })
}

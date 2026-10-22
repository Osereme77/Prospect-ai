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

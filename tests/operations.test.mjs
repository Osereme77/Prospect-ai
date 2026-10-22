import test from 'node:test'
import assert from 'node:assert/strict'
import { getQueueHealthAlerts, getWorkerHealthAlerts } from '../src/lib/operations.ts'

const now = Date.parse('2026-10-22T12:00:00.000Z')

test('does not warn for an empty or fresh email queue', () => {
  assert.deepEqual(getQueueHealthAlerts({
    queued_count: 1,
    oldest_queued_at: '2026-10-22T11:55:00.000Z',
    stale_sending_count: 0,
    failed_count: 0,
  }, now), [])
})

test('warns when the oldest queued email exceeds fifteen minutes', () => {
  assert.match(getQueueHealthAlerts({
    queued_count: 3,
    oldest_queued_at: '2026-10-22T11:40:00.000Z',
    stale_sending_count: 0,
    failed_count: 0,
  }, now)[0], /oldest of 3 queued email jobs has waited 20 minutes/)
})

test('warns about stale sending locks and failed deliveries', () => {
  assert.deepEqual(getQueueHealthAlerts({
    queued_count: 0,
    oldest_queued_at: null,
    stale_sending_count: 1,
    failed_count: 2,
  }, now), [
    '1 email job has a sending lock older than 15 minutes and may need worker recovery.',
    '2 email delivery jobs need review in Notification delivery.',
  ])
})

const worker = (overrides = {}) => ({
  worker: 'scheduled-discovery',
  last_started_at: null,
  last_finished_at: null,
  last_status: null,
  last_error_code: null,
  last_claimed: 0,
  last_completed: 0,
  last_failed: 0,
  ...overrides,
})

test('warns when no scheduled worker run has completed', () => {
  assert.match(getWorkerHealthAlerts([worker()], now)[0], /has not completed a run yet/)
})

test('does not warn for a recent successful scheduled worker run', () => {
  assert.deepEqual(getWorkerHealthAlerts([worker({
    last_started_at: '2026-10-22T11:55:00.000Z',
    last_finished_at: '2026-10-22T11:56:00.000Z',
    last_status: 'succeeded',
    last_claimed: 1,
    last_completed: 1,
  })], now), [])
})

test('warns for a scheduled worker that is stale, stuck, or failed', () => {
  assert.match(getWorkerHealthAlerts([worker({
    last_finished_at: '2026-10-20T23:00:00.000Z', last_status: 'succeeded',
  })], now)[0], /within 36 hours/)
  assert.match(getWorkerHealthAlerts([worker({
    last_started_at: '2026-10-22T11:40:00.000Z', last_status: 'running',
  })], now)[0], /running for at least 15 minutes/)
  assert.match(getWorkerHealthAlerts([worker({
    last_finished_at: '2026-10-22T11:50:00.000Z', last_status: 'failed', last_error_code: 'source_run_failed',
  })], now)[0], /last failed \(source_run_failed\)/)
})

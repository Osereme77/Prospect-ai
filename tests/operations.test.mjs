import test from 'node:test'
import assert from 'node:assert/strict'
import { getQueueHealthAlerts } from '../src/lib/operations.ts'

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

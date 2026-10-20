import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeWorkspace } from '../src/lib/dashboard.ts'

const lead = (id, status, score = 50) => ({ id, status, score })
const source = (id, enabled) => ({ id, enabled })
const run = (status, createdAt) => ({ status, createdAt, query: 'recent query' })

test('workspace summary derives totals and pipeline outcomes from saved lead state', () => {
  const summary = summarizeWorkspace([
    lead('new', 'New', 90),
    lead('shortlisted', 'Shortlisted', 85),
    lead('applied', 'Applied'),
    lead('replied', 'Replied'),
    lead('interview', 'Interviewing'),
    lead('won', 'Won'),
    lead('lost', 'Lost'),
    lead('dismissed', 'Dismissed'),
  ], [], [])

  assert.deepEqual({
    total: summary.total,
    newCount: summary.newCount,
    strongFit: summary.strongFit,
    workInProgress: summary.workInProgress,
    repliesAndInterviews: summary.repliesAndInterviews,
    wins: summary.wins,
    losses: summary.losses,
  }, { total: 8, newCount: 1, strongFit: 2, workInProgress: 2, repliesAndInterviews: 2, wins: 1, losses: 1 })
})

test('source health describes the latest recorded run without claiming global provider readiness', () => {
  assert.equal(summarizeWorkspace([], [], []).sourceHealth, 'No source registered')
  assert.equal(summarizeWorkspace([], [source('s1', true)], []).sourceHealth, 'No run recorded')
  const summary = summarizeWorkspace([], [source('s1', true), source('s2', false)], [
    run('completed', '2026-01-01T00:00:00Z'),
    run('failed', '2026-02-01T00:00:00Z'),
  ])
  assert.equal(summary.ownerApprovedSources, 1)
  assert.equal(summary.sourceHealth, 'Latest run needs attention')
  assert.equal(summary.latestRun.status, 'failed')
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { readLeads, readProfile, saveLeads, saveProfile } from '../src/lib/storage.ts'

test('local lead and profile records can be saved and retrieved', t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const data = new Map()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, String(value)),
    },
  })
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else delete globalThis.localStorage
  })

  const lead = {
    id: 'recovery-check-1', title: 'Test lead', organization: 'Test org', kind: 'Opportunity',
    url: '', location: 'Not specified', postedAt: 'Added just now', summary: 'Manual test record',
    status: 'New', score: 75, scoreReason: 'Verified test score', source: 'Manual entry',
    tags: [], evidence: ['No public source recorded.'], createdAt: '2026-10-22T00:00:00.000Z',
  }
  const profile = {
    name: 'Recovery check', role: 'Developer', skills: ['TypeScript'], services: ['MVP delivery'],
    markets: ['Nigeria'], portfolioLinks: [], experienceSummary: '', notificationThreshold: 65,
    emailNotificationsEnabled: false,
  }

  assert.equal(saveLeads([lead]), true)
  assert.deepEqual(readLeads(), [lead])
  assert.equal(saveProfile(profile), true)
  assert.deepEqual(readProfile(), profile)
})

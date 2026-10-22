import test from 'node:test'
import assert from 'node:assert/strict'
import { restoreInitialSession } from '../src/lib/authSession.ts'

test('restores the saved Supabase session', async () => {
  const session = { user: { id: 'owner' } }
  const result = await restoreInitialSession(async () => ({ data: { session } }), () => false)
  assert.deepEqual(result, { kind: 'restored', session })
})

test('treats a reported session lookup error as recoverable', async () => {
  const result = await restoreInitialSession(async () => ({ data: { session: null }, error: new Error('storage unavailable') }), () => false)
  assert.deepEqual(result, { kind: 'unavailable' })
})

test('treats a rejected session lookup as recoverable', async () => {
  const result = await restoreInitialSession(async () => { throw new Error('storage unavailable') }, () => false)
  assert.deepEqual(result, { kind: 'unavailable' })
})

test('keeps an auth event result when session restoration finishes later', async () => {
  let authEventReceived = false
  let finishLookup
  const lookup = new Promise((resolve) => { finishLookup = resolve })
  const restoration = restoreInitialSession(() => lookup, () => authEventReceived)
  authEventReceived = true
  finishLookup({ data: { session: null } })
  assert.deepEqual(await restoration, { kind: 'superseded' })
})

test('keeps an auth event result when session restoration rejects later', async () => {
  let authEventReceived = false
  let rejectLookup
  const lookup = new Promise((_, reject) => { rejectLookup = reject })
  const restoration = restoreInitialSession(() => lookup, () => authEventReceived)
  authEventReceived = true
  rejectLookup(new Error('stale lookup'))
  assert.deepEqual(await restoration, { kind: 'superseded' })
})

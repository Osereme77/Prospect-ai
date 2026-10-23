import test from 'node:test'
import assert from 'node:assert/strict'
import { discoveryFailureMessage } from '../src/lib/discoveryErrors.ts'

test('discovery failures map known server codes to safe actionable guidance', async () => {
  const cases = [
    ['source_not_approved_by_owner', /approved for your account/],
    ['provider_not_configured_or_disabled', /server settings/],
    ['monthly_limit_reached', /monthly discovery limit/],
    ['provider_error', /public feed could not be reached/],
  ]

  for (const [code, expected] of cases) {
    const error = { context: new Response(JSON.stringify({ error: code, detail: 'must not be shown' }), { status: 503 }) }
    const message = await discoveryFailureMessage(error)
    assert.match(message, expected)
    assert.doesNotMatch(message, /must not be shown/)
  }
})

test('discovery failures do not display unknown server response text', async () => {
  const error = { context: new Response(JSON.stringify({ error: 'unexpected', detail: 'private upstream response' }), { status: 502 }) }
  assert.equal(await discoveryFailureMessage(error), 'Discovery failed. Check the connection and retry. If it continues, check the provider and quota settings.')
})

test('discovery result-save failure gets separate guidance', async () => {
  assert.match(await discoveryFailureMessage(new Error('save_failed')), /search completed, but its results could not be saved/)
})

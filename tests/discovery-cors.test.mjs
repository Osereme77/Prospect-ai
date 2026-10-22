import test from 'node:test'
import assert from 'node:assert/strict'
import { discoveryCorsHeaders } from '../supabase/functions/_shared/cors.ts'

test('discovery CORS allows only explicitly configured HTTP origins', () => {
  const headers = discoveryCorsHeaders(
    'https://ui-test--jobsremyai.netlify.app',
    'https://ui-test--jobsremyai.netlify.app,http://localhost:5173',
    undefined,
  )

  assert.equal(headers['Access-Control-Allow-Origin'], 'https://ui-test--jobsremyai.netlify.app')
  assert.equal(headers['Access-Control-Allow-Methods'], 'POST, OPTIONS')
  assert.equal(headers.Vary, 'Origin')
})

test('discovery CORS keeps the legacy single-origin setting compatible', () => {
  assert.equal(
    discoveryCorsHeaders('https://preview.example', undefined, 'https://preview.example')['Access-Control-Allow-Origin'],
    'https://preview.example',
  )
})

test('discovery CORS rejects unconfigured, opaque, and malformed origins', () => {
  for (const origin of ['https://attacker.example', 'null', 'https://ui-test--jobsremyai.netlify.app/path']) {
    const headers = discoveryCorsHeaders(origin, 'https://ui-test--jobsremyai.netlify.app', undefined)
    assert.equal(headers['Access-Control-Allow-Origin'], undefined)
  }
})

test('discovery CORS emits no allow-origin header when no browser origin is configured', () => {
  const headers = discoveryCorsHeaders('https://ui-test--jobsremyai.netlify.app', undefined, undefined)
  assert.equal(headers['Access-Control-Allow-Origin'], undefined)
})

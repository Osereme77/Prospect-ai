const allowedMethods = 'POST, OPTIONS'
const allowedHeaders = 'authorization, x-client-info, apikey, content-type, idempotency-key'
// Exact origins for the deployed app. Keep this list explicit; never allow
// arbitrary Netlify subdomains or reflect an untrusted Origin header.
const deployedOrigins = [
  'https://jobsremyai.netlify.app',
  'https://ui-test--jobsremyai.netlify.app',
]

function normalizeOrigin(value: string): string | null {
  try {
    const parsed = new URL(value)
    if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || parsed.origin !== value) return null
    return parsed.origin
  } catch {
    return null
  }
}

export function discoveryCorsHeaders(origin: string | null, configuredOrigins: string | null | undefined, legacyOrigin: string | null | undefined): Record<string, string> {
  const allowed = new Set([...deployedOrigins, configuredOrigins ?? '', legacyOrigin ?? '']
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .map(normalizeOrigin)
    .filter((value): value is string => value !== null))
  const normalizedRequestOrigin = origin ? normalizeOrigin(origin) : null
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': allowedHeaders,
    'Access-Control-Allow-Methods': allowedMethods,
    'Vary': 'Origin',
  }
  if (normalizedRequestOrigin && allowed.has(normalizedRequestOrigin)) {
    headers['Access-Control-Allow-Origin'] = normalizedRequestOrigin
  }
  return headers
}

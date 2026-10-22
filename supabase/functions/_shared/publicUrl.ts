const trackingParameters = new Set(['gclid', 'fbclid', 'mc_cid', 'mc_eid'])
const nonPublicSuffixes = [
  '.localhost', '.local', '.localdomain', '.internal', '.intranet',
  '.private', '.lan', '.home', '.home.arpa', '.corp', '.test', '.invalid', '.example',
]

function isNonPublicIpv4(host: string): boolean {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false
  const octets = host.split('.').map(Number)
  if (octets.some(octet => octet < 0 || octet > 255)) return true
  const [first, second] = octets
  return first === 0 || first === 10 || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 198 && (second === 18 || second === 19))
    || first >= 224
}

export function safePublicUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value.trim())
    const host = url.hostname.toLowerCase().replace(/\.+$/, '')
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null
    if (!host.includes('.') || host.includes(':') || host === '0.0.0.0') return null
    if (host === 'localhost' || nonPublicSuffixes.some(suffix => host.endsWith(suffix))) return null
    if (isNonPublicIpv4(host)) return null
    url.hostname = host
    return url.toString()
  } catch { return null }
}

export function canonicalPublicUrl(value: string): string | null {
  const safe = safePublicUrl(value)
  if (!safe) return null
  try {
    const url = new URL(safe)
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || trackingParameters.has(key.toLowerCase())) url.searchParams.delete(key)
    }
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '')
    return url.toString()
  } catch { return null }
}

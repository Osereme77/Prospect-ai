const trackingParameters = new Set(['gclid', 'fbclid', 'mc_cid', 'mc_eid'])

export function canonicalPublicUrl(value: string): string | null {
  if (!value || value.length > 2048) return null
  try {
    const url = new URL(value.trim())
    const host = url.hostname.toLowerCase()
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return null
    if (/^(0|10|127|169\.254|192\.168)\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return null
    if (/^(224|23[0-9]|24\d|25[0-5])\./.test(host) || host === '0.0.0.0') return null
    if (host.includes(':') && !/^(?:[0-9a-f]{1,4}:){1,7}[0-9a-f]{0,4}$/i.test(host)) return null
    if (host === '::' || host === '::1' || /^(fc|fd|fe80):/i.test(host)) return null
    if (!host.includes('.')) return null
    url.hostname = host
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key) || trackingParameters.has(key.toLowerCase())) url.searchParams.delete(key)
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '')
    return url.toString()
  } catch { return null }
}

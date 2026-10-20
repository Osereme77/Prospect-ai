export interface DiscoveryRequest {
  query: string
  country: string
  count: number
}

export interface DiscoveryResult {
  title: string
  url: string
  snippet: string
  source: string
}

export interface DiscoveryProvider {
  readonly name: string
  search(request: DiscoveryRequest, secret: string): Promise<DiscoveryResult[]>
}

export class BraveSearchProvider implements DiscoveryProvider {
  readonly name = 'Brave Search'

  async search(request: DiscoveryRequest, secret: string): Promise<DiscoveryResult[]> {
    const url = new URL('https://api.search.brave.com/res/v1/web/search')
    url.searchParams.set('q', request.query)
    url.searchParams.set('country', request.country)
    url.searchParams.set('search_lang', 'en')
    url.searchParams.set('count', String(request.count))
    const response = await fetch(url, {
      headers: { 'X-Subscription-Token': secret, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) throw new Error(`provider_http_${response.status}`)
    return normalizeBraveResults(await response.json())
  }
}

export function normalizeBraveResults(payload: unknown): DiscoveryResult[] {
  if (!payload || typeof payload !== 'object') return []
  const web = (payload as { web?: unknown }).web
  if (!web || typeof web !== 'object') return []
  const results = (web as { results?: unknown }).results
  if (!Array.isArray(results)) return []
  return results.flatMap((candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object') return []
    const item = candidate as Record<string, unknown>
    const url = safePublicUrl(item.url)
    if (!url) return []
    return [{
      title: typeof item.title === 'string' ? item.title.slice(0, 300) : 'Untitled result',
      url,
      snippet: typeof item.description === 'string' ? item.description.slice(0, 1500) : '',
      source: 'Brave Search',
    }]
  })
}

export function safePublicUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (!['https:', 'http:'].includes(url.protocol) || !host.includes('.') || url.username || url.password) return null
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return null
    if (/^(0|10|127|169\.254|192\.168)\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return null
    if (/^(224|23[0-9]|24\d|25[0-5])\./.test(host) || host === '0.0.0.0' || host.includes(':')) return null
    return url.toString()
  } catch { return null }
}

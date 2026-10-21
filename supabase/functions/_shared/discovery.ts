export interface DiscoveryRequest {
  query: string
  country: string
  count: number
}

export interface DiscoveryResult {
  title: string
  organization?: string
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

// Remote OK publishes a public JSON feed. The query is applied locally so the
// user's profile and search terms are never sent to the feed provider.
export class RemoteOkProvider {
  readonly name = 'Remote OK'

  async search(request: DiscoveryRequest): Promise<DiscoveryResult[]> {
    const response = await fetch('https://remoteok.com/api', {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ProspectAI/1.0 (public job feed)' },
      signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) throw new Error(`provider_http_${response.status}`)
    return normalizeRemoteOkResults(await response.json(), request.query, request.count)
  }
}

export function normalizeRemoteOkResults(payload: unknown, query: string, count: number): DiscoveryResult[] {
  if (!Array.isArray(payload)) return []
  const terms = query.toLowerCase().split(/[^a-z0-9+#.]+/).filter(term => term.length > 2 && !['job','jobs','contract','freelance','opportunity'].includes(term))
  return payload.flatMap((candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object') return []
    const item = candidate as Record<string, unknown>
    // The first feed item is metadata, not a job.
    if (typeof item.id !== 'number' && typeof item.id !== 'string') return []
    const rawUrl = typeof item.url === 'string' ? item.url : typeof item.apply_url === 'string' ? item.apply_url : ''
    const url = safePublicUrl(rawUrl)
    if (!url || new URL(url).hostname.replace(/^www\./, '') !== 'remoteok.com') return []
    const title = typeof item.position === 'string' ? item.position.slice(0, 300) : 'Untitled remote role'
    const company = typeof item.company === 'string' ? item.company.slice(0, 160) : ''
    const tags = Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string').join(' ') : ''
    const description = typeof item.description === 'string' ? item.description : ''
    const snippet = description.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim().slice(0, 700)
    const searchable = `${title} ${company} ${tags} ${snippet}`.toLowerCase()
    if (terms.length && !terms.some(term => searchable.includes(term))) return []
    return [{ title, organization: company || undefined, url, snippet, source: 'Remote OK' }]
  }).slice(0, Math.min(20, Math.max(1, count)))
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

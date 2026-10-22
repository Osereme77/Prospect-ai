import { scoreLead } from './scoring.ts'
import type { DiscoveryResult } from './discovery.ts'

export interface ScheduledDiscoveryProfile {
  skills: string[]
  services: string[]
}

export function scheduledRemoteOkPayload(results: DiscoveryResult[], profile: ScheduledDiscoveryProfile) {
  return results.slice(0, 20).flatMap(result => {
    let url: URL
    try { url = new URL(result.url) } catch { return [] }
    if (url.protocol !== 'https:' || !['remoteok.com', 'www.remoteok.com'].includes(url.hostname.toLowerCase())) return []

    const title = result.title.slice(0, 300).trim()
    const organization = (result.organization || 'Organization not listed').slice(0, 160).trim()
    const snippet = result.snippet.slice(0, 700).trim()
    if (!title || !organization) return []
    const scored = scoreLead(`${title} ${organization} ${snippet}`, profile.skills, profile.services, true, Boolean(snippet))
    return [{
      url: url.toString(), title, organization, snippet,
      score: scored.score,
      score_reason: scored.explanation,
      relevance: scored.breakdown.relevance,
      need_evidence: scored.breakdown.needEvidence,
      budget_signals: scored.breakdown.budgetSignals,
      freshness: scored.breakdown.freshness,
      source_confidence: scored.breakdown.sourceConfidence,
    }]
  })
}

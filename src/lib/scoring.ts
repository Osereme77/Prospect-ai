export * from '../../supabase/functions/_shared/scoring.ts'
import { calculateScore, type ScoreInput } from '../../supabase/functions/_shared/scoring.ts'

export function scoreLeadForQuery(text: string, query: string, hasPublicUrl: boolean, hasEvidence: boolean, hasVerifiedEvidence = false) {
  const terms = [...new Set((query.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []).map(term => term.trim()).filter(term => term.length > 1 && !['the', 'for', 'and', 'with', 'job', 'jobs', 'role', 'work', 'remote', 'in', 'at', 'to'].includes(term)))]
  const normalized = new Set((text.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []).map(token => token.trim()).filter(Boolean))
  const matching = terms.filter(term => normalized.has(term))
  const parts: ScoreInput = {
    relevance: terms.length ? Math.round(matching.length / terms.length * 100) : 0,
    needEvidence: hasEvidence ? (hasVerifiedEvidence ? 80 : 55) : 15,
    budgetSignals: 50,
    freshness: 50,
    sourceConfidence: hasPublicUrl ? (hasVerifiedEvidence ? 85 : hasEvidence ? 55 : 40) : 0,
  }
  const evidenceSummary = hasVerifiedEvidence ? 'includes owner-reviewed evidence' : hasEvidence ? 'has unverified source evidence' : 'is not recorded'
  return { score: calculateScore(parts), breakdown: parts, explanation: `Requested-query overlap ${matching.length}/${terms.length}; need signal ${evidenceSummary}; budget unknown; freshness unverified.` }
}

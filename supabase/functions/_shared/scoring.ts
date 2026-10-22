export interface ScoreInput { relevance: number; needEvidence: number; budgetSignals: number; freshness: number; sourceConfidence: number }
export const SCORE_WEIGHTS = { relevance: 0.35, needEvidence: 0.25, budgetSignals: 0.15, freshness: 0.15, sourceConfidence: 0.1 } as const

export function calculateScore(input: ScoreInput): number {
  if (Object.values(input).some(value => !Number.isFinite(value) || value < 0 || value > 100)) throw new Error('Score inputs must be between 0 and 100.')
  return Math.round(input.relevance * SCORE_WEIGHTS.relevance + input.needEvidence * SCORE_WEIGHTS.needEvidence + input.budgetSignals * SCORE_WEIGHTS.budgetSignals + input.freshness * SCORE_WEIGHTS.freshness + input.sourceConfidence * SCORE_WEIGHTS.sourceConfidence)
}

export function scoreLead(text: string, skills: string[], services: string[], hasPublicUrl: boolean, hasEvidence: boolean, hasVerifiedEvidence = false) {
  const normalized = new Set((text.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []).map(token => token.trim()).filter(Boolean))
  const interests = [...skills, ...services].map(item => item.toLowerCase().trim()).filter(Boolean)
  const matching = interests.filter(item => normalized.has(item) || item.split(/\s+/).some(word => normalized.has(word)))
  const parts: ScoreInput = {
    relevance: interests.length ? Math.round(matching.length / interests.length * 100) : 0,
    needEvidence: hasEvidence ? (hasVerifiedEvidence ? 80 : 55) : 15,
    budgetSignals: 50,
    freshness: 50,
    sourceConfidence: hasPublicUrl ? (hasVerifiedEvidence ? 85 : hasEvidence ? 55 : 40) : 0,
  }
  const evidenceSummary = hasVerifiedEvidence ? 'includes owner-reviewed evidence' : hasEvidence ? 'has unverified source evidence' : 'is not recorded'
  return { score: calculateScore(parts), breakdown: parts, explanation: `Skill/service overlap ${matching.length}/${interests.length}; need signal ${evidenceSummary}; budget unknown; freshness unverified.` }
}

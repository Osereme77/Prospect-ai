export interface ScoreInput { relevance: number; needEvidence: number; budgetSignals: number; freshness: number; sourceConfidence: number }
export const SCORE_WEIGHTS = { relevance: 0.35, needEvidence: 0.25, budgetSignals: 0.15, freshness: 0.15, sourceConfidence: 0.1 } as const
export function calculateScore(input: ScoreInput): number {
  if (Object.values(input).some(value => !Number.isFinite(value) || value < 0 || value > 100)) throw new Error('Score inputs must be between 0 and 100.')
  return Math.round(input.relevance * SCORE_WEIGHTS.relevance + input.needEvidence * SCORE_WEIGHTS.needEvidence + input.budgetSignals * SCORE_WEIGHTS.budgetSignals + input.freshness * SCORE_WEIGHTS.freshness + input.sourceConfidence * SCORE_WEIGHTS.sourceConfidence)
}

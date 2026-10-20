import { describe, expect, it } from 'vitest'
import { calculateScore } from './scoring'

describe('calculateScore', () => {
  it('applies the documented weights and rounds to the nearest integer', () => {
    expect(calculateScore({ relevance: 100, needEvidence: 80, budgetSignals: 50, freshness: 60, sourceConfidence: 90 })).toBe(81)
  })
  it('rejects values outside the documented input scale', () => {
    expect(() => calculateScore({ relevance: 101, needEvidence: 0, budgetSignals: 0, freshness: 0, sourceConfidence: 0 })).toThrow()
  })
})

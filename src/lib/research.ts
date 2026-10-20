import type { EvidenceItem } from '../types'
import { canonicalPublicUrl } from './urls.ts'

const MAX_PAGE_TEXT = 8000
const gaps = ['Evidence of need', 'Budget', 'Timing', 'Public contact channel']
const instructionLike = /\b(ignore|disregard|override)\b.{0,50}\b(instructions?|prompts?|rules?)\b|\b(system|developer)\s+prompt\b|\b(as an ai|chatgpt|language model)\b/i

export interface PublicResearchResult {
  sourceUrl: string
  observedAt: string
  evidence: EvidenceItem[]
  gaps: string[]
  budgetSignal?: string
  timingSignal?: string
}

/** Extracts only explicit, short statements from owner-provided public page text.
 * Content is treated as inert data; no remote fetch or model call is made. */
export function reviewPublicPage(text: string, sourceUrl: string, now = new Date().toISOString()): PublicResearchResult {
  const url = canonicalPublicUrl(sourceUrl)
  if (!url) throw new Error('Research requires a valid public HTTP or HTTPS source URL.')
  const bounded = text.slice(0, MAX_PAGE_TEXT)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()

  const sentences = bounded.split(/(?<=[.!?])\s+/).map(value => value.trim()).filter(value => value.length >= 20 && value.length <= 500 && !instructionLike.test(value))
  const need = sentences.filter(value => /\b(hiring|seeking|looking for|need(?:s|ed)?|require(?:s|d)?|challenge|problem|build|launch|replace|improve|support)\b/i.test(value)).slice(0, 3)
  const budget = sentences.find(value => /(?:\b(?:budget|salary|compensation|rate|funding|grant)\b|(?:USD|NGN|GHS|GBP|EUR|[$₦€£])\s?\d)/i.test(value))
  const timing = sentences.find(value => /\b(?:deadline|starting|starts|beginning|posted|closing|expires|within \d+ days|\d{4}-\d{2}-\d{2})\b/i.test(value))
  const selected = [...new Set([...need, ...(budget ? [budget] : []), ...(timing ? [timing] : [])])].slice(0, 5)
  const gapsFound = [
    ...(need.length ? [] : [gaps[0]]),
    ...(budget ? [] : [gaps[1]]),
    ...(timing ? [] : [gaps[2]]),
    gaps[3],
  ]
  return {
    sourceUrl: url,
    observedAt: now,
    evidence: selected.map(claim => ({ claim, sourceUrl: url, observedAt: now, type: 'public_page', status: 'unverified' })),
    gaps: gapsFound,
    budgetSignal: budget,
    timingSignal: timing,
  }
}

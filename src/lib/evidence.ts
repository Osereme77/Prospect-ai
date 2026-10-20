import type { EvidenceItem } from '../types'
import type { Lead, ProspectProfile } from '../types'
import { canonicalPublicUrl } from './urls.ts'
import { scoreLead } from './scoring.ts'

export function createEvidenceItem(claim: string, sourceUrl: string, now = new Date().toISOString()): EvidenceItem {
  const normalizedClaim = claim.trim()
  const normalizedUrl = canonicalPublicUrl(sourceUrl)
  if (!normalizedClaim) throw new Error('Add the observation you want to record.')
  if (!normalizedUrl) throw new Error('Evidence requires a valid public HTTP or HTTPS source URL.')
  return { claim: normalizedClaim, sourceUrl: normalizedUrl, observedAt: now, type: 'public_page', status: 'unverified' }
}

export function setEvidenceReview(item: EvidenceItem, verified: boolean, now = new Date().toISOString()): EvidenceItem {
  return verified
    ? { ...item, status: 'verified', reviewedAt: now }
    : { ...item, status: 'unverified', reviewedAt: undefined }
}

export function scoreEvidenceChanges(lead: Lead, profile: ProspectProfile, items: EvidenceItem[]): Lead {
  const reviewed = items.some(item => item.status === 'verified')
  const scored = scoreLead(
    [lead.title, lead.summary, ...lead.tags, ...items.map(item => item.claim)].join(' '),
    profile.skills,
    profile.services,
    Boolean(lead.url || items.length),
    items.length > 0,
    reviewed,
  )
  return { ...lead, evidence: items.map(item => item.claim), evidenceDetails: items, score: scored.score, scoreReason: scored.explanation, scoreBreakdown: scored.breakdown }
}

import type { DiscoverySource, Lead, LeadStatus, SearchRun } from '../types'

const activeWorkStatuses = new Set<LeadStatus>(['Shortlisted', 'Contacted', 'Applied'])
const responseStatuses = new Set<LeadStatus>(['Replied', 'Interviewing'])

export interface WorkspaceSummary {
  total: number
  newCount: number
  strongFit: number
  workInProgress: number
  repliesAndInterviews: number
  wins: number
  losses: number
  sourceCount: number
  ownerApprovedSources: number
  sourceHealth: string
  latestRun?: SearchRun
}

export function summarizeWorkspace(leads: Lead[], sources: DiscoverySource[], runs: SearchRun[]): WorkspaceSummary {
  const latestRun = [...runs].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
  const ownerApprovedSources = sources.filter(source => source.enabled).length
  const sourceHealth = sources.length === 0
    ? 'No source registered'
    : !latestRun
      ? 'No run recorded'
      : latestRun.status === 'failed' || latestRun.status === 'cancelled'
        ? 'Latest run needs attention'
        : latestRun.status === 'queued' || latestRun.status === 'running'
          ? 'Latest run is in progress'
          : 'Latest run completed'

  return {
    total: leads.length,
    newCount: leads.filter(lead => lead.status === 'New').length,
    strongFit: leads.filter(lead => lead.score >= 85).length,
    workInProgress: leads.filter(lead => activeWorkStatuses.has(lead.status)).length,
    repliesAndInterviews: leads.filter(lead => responseStatuses.has(lead.status)).length,
    wins: leads.filter(lead => lead.status === 'Won').length,
    losses: leads.filter(lead => lead.status === 'Lost').length,
    sourceCount: sources.length,
    ownerApprovedSources,
    sourceHealth,
    latestRun,
  }
}

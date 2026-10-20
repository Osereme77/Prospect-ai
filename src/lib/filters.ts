import type { AppNotification, ContactAvailability, Lead, LeadStatus } from '../types'

export interface LeadFilters {
  query?: string
  status?: LeadStatus | ''
  minScore?: number
  location?: string
  source?: string
  service?: string
  budget?: 'known' | 'unknown' | ''
  contactAvailability?: ContactAvailability | ''
  withinDays?: number
  unreadOnly?: boolean
}

const normalize = (value: string) => value.trim().toLocaleLowerCase()
const budgetIsKnown = (value?: string) => Boolean(value?.trim()) && !['unknown', 'not disclosed', 'not specified', 'n/a'].includes(normalize(value!))

export function filterLeads(leads: Lead[], filters: LeadFilters, notifications: AppNotification[] = [], now = Date.now()): Lead[] {
  const unreadIds = new Set(notifications.filter(item => !item.readAt && item.leadId).map(item => item.leadId!))
  const query = normalize(filters.query ?? '')
  const location = normalize(filters.location ?? '')
  const service = normalize(filters.service ?? '')
  const cutoff = filters.withinDays ? now - filters.withinDays * 24 * 60 * 60 * 1000 : undefined
  return leads.filter(lead => {
    if (filters.status && lead.status !== filters.status) return false
    if (typeof filters.minScore === 'number' && lead.score < filters.minScore) return false
    if (query && !normalize([lead.title, lead.organization, lead.summary, ...lead.tags].join(' ')).includes(query)) return false
    if (location && !normalize(lead.location).includes(location)) return false
    if (filters.source && lead.source !== filters.source) return false
    if (service && !lead.tags.some(tag => normalize(tag) === service)) return false
    if (filters.budget === 'known' && !budgetIsKnown(lead.budget)) return false
    if (filters.budget === 'unknown' && budgetIsKnown(lead.budget)) return false
    if (filters.contactAvailability && (lead.contactAvailability ?? 'unknown') !== filters.contactAvailability) return false
    if (cutoff && Date.parse(lead.createdAt) < cutoff) return false
    if (filters.unreadOnly && !unreadIds.has(lead.id)) return false
    return true
  })
}

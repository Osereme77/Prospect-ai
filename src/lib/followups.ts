import type { Lead } from '../types'

const terminalStatuses = new Set(['Won', 'Lost', 'Dismissed'])

function localDateKey(now: Date): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isFollowUpDue(lead: Pick<Lead, 'followUp' | 'status'>, now = new Date()): boolean {
  const date = lead.followUp
  if (!date || terminalStatuses.has(lead.status) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return false
  return date <= localDateKey(now)
}

export function countFollowUpsDue(leads: Lead[], now = new Date()): number {
  return leads.filter(lead => isFollowUpDue(lead, now)).length
}

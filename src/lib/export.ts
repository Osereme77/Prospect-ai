import type { Lead } from '../types'

const headers = ['id','kind','title','organization','status','score','score_reason','source','source_url','location','budget','follow_up','duplicate_of','tags','evidence','summary','notes','created_at']
const cell = (value:unknown) => `"${String(value??'').replace(/"/g,'""')}"`

export function leadsToCsv(leads:Lead[]) {
  const rows = leads.map(lead => [lead.id,lead.kind,lead.title,lead.organization,lead.status,lead.score,lead.scoreReason,lead.source,lead.url,lead.location,lead.budget,lead.followUp,lead.duplicateOf,lead.tags.join('; '),lead.evidence.join('; '),lead.summary,lead.notes,lead.createdAt])
  return [headers,...rows].map(row=>row.map(cell).join(',')).join('\r\n')
}

export function downloadLeadsCsv(leads:Lead[], filename='prospect-ai-leads.csv') {
  if (!leads.length) return false
  const blob = new Blob(['\uFEFF',leadsToCsv(leads)],{type:'text/csv;charset=utf-8'})
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href=url;anchor.download=filename;anchor.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
  return true
}

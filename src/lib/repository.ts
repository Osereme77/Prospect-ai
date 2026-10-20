import type { User } from '@supabase/supabase-js'
import type { AppNotification, Lead, LeadStatus, ProspectProfile, SearchRun } from '../types'
import { supabase } from './supabase'

const dbStatus = (status: LeadStatus) => status.toLowerCase()
const uiStatus = (status: string): LeadStatus => {
  const match: LeadStatus | undefined = (['New','Reviewed','Shortlisted','Contacted','Applied','Replied','Interviewing','Won','Lost','Dismissed'] as LeadStatus[]).find(item => item.toLowerCase() === status)
  return match ?? 'New'
}
const safeDate = (value: string | null) => value ? value.slice(0, 10) : undefined

export async function loadCloudWorkspace(user: User): Promise<{ leads: Lead[]; profile: ProspectProfile; notifications: AppNotification[]; runs:SearchRun[] }> {
  if (!supabase) throw new Error('Cloud mode is not configured.')
  const [leadResult, profileResult, notificationResult, runResult] = await Promise.all([
    supabase.from('leads').select('*, lead_evidence(claim,source_url), lead_scores(score,relevance,need_evidence,budget_signals,freshness,source_confidence,explanation,created_at)').eq('owner_id', user.id).order('created_at', { ascending: false }),
    supabase.from('profiles').select('display_name,headline,skills,services,markets,portfolio_links,experience_summary,notification_threshold').eq('id', user.id).maybeSingle(),
    supabase.from('notifications').select('id,kind,title,body,lead_id,read_at,created_at').eq('owner_id', user.id).order('created_at', { ascending: false }),
    supabase.from('search_runs').select('id,query,status,result_count,created_at,finished_at,error_summary').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(10),
  ])
  if (leadResult.error) throw leadResult.error
  if (profileResult.error) throw profileResult.error
  if (notificationResult.error) throw notificationResult.error
  if (runResult.error) throw runResult.error
  const leads: Lead[] = (leadResult.data ?? []).map(row => {
    const evidence = (row.lead_evidence ?? []).map((item: { claim: string }) => item.claim)
    const scoreRow = [...(row.lead_scores ?? [])].sort((a: { created_at:string }, b: { created_at:string }) => Date.parse(b.created_at)-Date.parse(a.created_at))[0]
    return {
      id: row.id, title: row.title, organization: row.organization, kind: row.kind === 'company' ? 'Company' : 'Opportunity',
      url: row.source_url ?? '', location: row.location ?? 'Not specified', postedAt: row.posted_label ?? 'Saved prospect',
      summary: row.summary ?? '', status: uiStatus(row.status), score: scoreRow?.score ?? row.score ?? 50,
      scoreReason: row.score_reason ?? 'Score not calculated yet.', source: row.source_label ?? 'Saved prospect',
      tags: row.tags ?? [], evidence, budget: row.budget_signal ?? undefined, followUp: safeDate(row.follow_up_at),
      notes: row.notes ?? '', createdAt: row.created_at,
      scoreBreakdown: scoreRow ? { relevance:scoreRow.relevance, needEvidence:scoreRow.need_evidence, budgetSignals:scoreRow.budget_signals, freshness:scoreRow.freshness, sourceConfidence:scoreRow.source_confidence } : undefined,
      duplicateOf:row.duplicate_of??undefined,
    }
  })
  const profile = profileResult.data
  const notifications:AppNotification[]=(notificationResult.data??[]).map(row=>({id:row.id,kind:row.kind,title:row.title,body:row.body,leadId:row.lead_id??undefined,readAt:row.read_at??undefined,createdAt:row.created_at}))
  const runs:SearchRun[]=(runResult.data??[]).map(row=>({id:row.id,query:row.query,status:row.status,resultCount:row.result_count,createdAt:row.created_at,finishedAt:row.finished_at??undefined,error:row.error_summary??undefined}))
  return { leads, notifications, runs, profile: profile ? { name: profile.display_name || user.email?.split('@')[0] || 'User', role: profile.headline || '', skills: profile.skills ?? [], services: profile.services ?? [], markets: profile.markets ?? [], portfolioLinks:profile.portfolio_links??[], experienceSummary:profile.experience_summary??'', notificationThreshold:profile.notification_threshold??65 } : { name: user.email?.split('@')[0] || 'User', role: '', skills: [], services: [], markets: [], portfolioLinks:[], experienceSummary:'', notificationThreshold:65 } }
}

export async function saveCloudWorkspace(user: User, leads: Lead[], profile?: ProspectProfile) {
  if (!supabase) throw new Error('Cloud mode is not configured.')
  if (profile) {
    const { error } = await supabase.from('profiles').upsert({ id: user.id, display_name: profile.name, headline: profile.role, skills: profile.skills, services: profile.services, markets: profile.markets, portfolio_links:profile.portfolioLinks, experience_summary:profile.experienceSummary, notification_threshold:profile.notificationThreshold, updated_at: new Date().toISOString() })
    if (error) throw error
  }
  const { data: existing, error: listError } = await supabase.from('leads').select('id').eq('owner_id', user.id)
  if (listError) throw listError
  const retained = new Set(leads.map(lead => lead.id))
  const removed = (existing ?? []).map(row => row.id).filter(id => !retained.has(id))
  if (removed.length) {
    const { error } = await supabase.from('leads').delete().eq('owner_id', user.id).in('id', removed)
    if (error) throw error
  }
  if (!leads.length) return
  const { error: leadError } = await supabase.from('leads').upsert(leads.map(lead => ({
    id: lead.id, owner_id: user.id, kind: lead.kind.toLowerCase(), title: lead.title, organization: lead.organization,
    source_url: lead.url || null, location: lead.location || null, summary: lead.summary, status: dbStatus(lead.status),
    budget_signal: lead.budget ?? null, follow_up_at: lead.followUp ?? null, notes: lead.notes ?? '', duplicate_of:lead.duplicateOf??null,
    source_label: lead.source, tags: lead.tags, posted_label: lead.postedAt, score: lead.score, score_reason: lead.scoreReason,
    updated_at: new Date().toISOString(),
  })), { onConflict: 'id' })
  if (leadError) throw leadError
  const evidence = leads.flatMap(lead => lead.evidence.filter(claim => Boolean(lead.url)).map(claim => ({ lead_id: lead.id, owner_id: user.id, source_url: lead.url, claim })))
  if (evidence.length) {
    const { error } = await supabase.from('lead_evidence').upsert(evidence, { onConflict: 'lead_id,source_url,claim', ignoreDuplicates: true })
    if (error) throw error
  }
  const scoreable = leads.filter(lead => lead.scoreBreakdown)
  if (scoreable.length) {
    const { data: oldScores, error: scoreReadError } = await supabase.from('lead_scores').select('lead_id,score,relevance,need_evidence,budget_signals,freshness,source_confidence,created_at').eq('owner_id', user.id).in('lead_id', scoreable.map(lead => lead.id)).order('created_at', { ascending: false })
    if (scoreReadError) throw scoreReadError
    const latest = new Map<string, {lead_id:string;score:number;relevance:number;need_evidence:number;budget_signals:number;freshness:number;source_confidence:number}>()
    for (const row of oldScores ?? []) if (!latest.has(row.lead_id)) latest.set(row.lead_id, row)
    const snapshots = scoreable.flatMap(lead => {
      const parts = lead.scoreBreakdown!
      const old = latest.get(lead.id)
      if (old && old.score === lead.score && old.relevance === parts.relevance && old.need_evidence === parts.needEvidence && old.budget_signals === parts.budgetSignals && old.freshness === parts.freshness && old.source_confidence === parts.sourceConfidence) return []
      return [{ lead_id:lead.id, owner_id:user.id, score:lead.score, relevance:parts.relevance, need_evidence:parts.needEvidence, budget_signals:parts.budgetSignals, freshness:parts.freshness, source_confidence:parts.sourceConfidence, explanation:{summary:lead.scoreReason}, scoring_version:'v1' }]
    })
    if (snapshots.length) {
      const { error } = await supabase.from('lead_scores').upsert(snapshots, { onConflict: 'lead_id,scoring_version,score,relevance,need_evidence,budget_signals,freshness,source_confidence', ignoreDuplicates: true })
      if (error) throw error
    }
  }
}

export async function saveCloudNotification(user:User, notification:AppNotification) {
  if(!supabase)throw new Error('Cloud mode is not configured.')
  const {error}=await supabase.from('notifications').upsert({id:notification.id,owner_id:user.id,lead_id:notification.leadId??null,kind:notification.kind,title:notification.title,body:notification.body,read_at:notification.readAt??null,idempotency_key:notification.id},{onConflict:'owner_id,idempotency_key'})
  if(error)throw error
}

export async function markCloudNotificationsRead(user:User, ids:string[]) {
  if(!supabase||!ids.length)return
  const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('owner_id',user.id).in('id',ids).is('read_at',null)
  if(error)throw error
}

export async function dismissCloudNotification(user:User,id:string) {
  if(!supabase)return
  const {error}=await supabase.from('notifications').delete().eq('owner_id',user.id).eq('id',id)
  if(error)throw error
}

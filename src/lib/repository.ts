import type { User } from '@supabase/supabase-js'
import type { AppNotification, DiscoverySource, EvidenceItem, Lead, LeadStatus, ProspectProfile, SearchRun } from '../types'
import type { AdminQueueHealth } from './operations'
import { supabase } from './supabase'

const dbStatus = (status: LeadStatus): Lowercase<LeadStatus> => status.toLowerCase() as Lowercase<LeadStatus>
const uiStatus = (status: string): LeadStatus => {
  const match: LeadStatus | undefined = (['New','Reviewed','Shortlisted','Contacted','Applied','Replied','Interviewing','Won','Lost','Dismissed'] as LeadStatus[]).find(item => item.toLowerCase() === status)
  return match ?? 'New'
}
const safeDate = (value: string | null) => value ? value.slice(0, 10) : undefined

export async function loadCloudWorkspace(user: User): Promise<{ leads: Lead[]; profile: ProspectProfile; notifications: AppNotification[]; runs:SearchRun[]; sources:DiscoverySource[]; role:'user'|'admin'|'super_admin' }> {
  if (!supabase) throw new Error('Cloud mode is not configured.')
  const [leadResult, profileResult, notificationResult, runResult, sourceResult,roleResult] = await Promise.all([
    supabase.from('leads').select('*, lead_evidence(claim,source_url,observed_at,evidence_type,verification_status,reviewed_at), lead_scores(score,relevance,need_evidence,budget_signals,freshness,source_confidence,explanation,created_at)').eq('owner_id', user.id).order('created_at', { ascending: false }),
    supabase.from('profiles').select('display_name,headline,skills,services,markets,portfolio_links,experience_summary,notification_threshold,email_notifications_enabled').eq('id', user.id).maybeSingle(),
    supabase.from('notifications').select('id,kind,title,body,lead_id,read_at,created_at').eq('owner_id', user.id).order('created_at', { ascending: false }),
    supabase.from('search_runs').select('id,query,status,result_count,created_at,finished_at,error_summary').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(10),
    supabase.from('discovery_sources').select('id,name,kind,base_url,enabled,config').eq('owner_id',user.id).order('created_at',{ascending:true}),
    supabase.from('user_roles').select('role').eq('user_id',user.id).maybeSingle(),
  ])
  if (leadResult.error) throw leadResult.error
  if (profileResult.error) throw profileResult.error
  if (notificationResult.error) throw notificationResult.error
  if (runResult.error) throw runResult.error
  if (sourceResult.error) throw sourceResult.error
  if (roleResult.error) throw roleResult.error
  const leads: Lead[] = (leadResult.data ?? []).map(row => {
    const evidenceDetails:EvidenceItem[]=(row.lead_evidence??[]).map((item:{claim:string;source_url:string;observed_at:string;evidence_type:string;verification_status:string;reviewed_at:string|null})=>({claim:item.claim,sourceUrl:item.source_url,observedAt:item.observed_at,type:item.evidence_type==='owner_note'?'owner_note':'public_page',status:item.verification_status==='verified'?'verified':'unverified',reviewedAt:item.reviewed_at??undefined}))
    const evidence = evidenceDetails.map(item => item.claim)
    const scoreRow = [...(row.lead_scores ?? [])].sort((a: { created_at:string }, b: { created_at:string }) => Date.parse(b.created_at)-Date.parse(a.created_at))[0]
    return {
      id: row.id, title: row.title, organization: row.organization, kind: row.kind === 'company' ? 'Company' : 'Opportunity',
      url: row.source_url ?? '', location: row.location ?? 'Not specified', postedAt: row.posted_label ?? 'Saved prospect',
      summary: row.summary ?? '', status: uiStatus(row.status), score: scoreRow?.score ?? row.score ?? 50,
      scoreReason: row.score_reason ?? 'Score not calculated yet.', source: row.source_label ?? 'Saved prospect',
      sourceId:row.source_id??undefined, searchRunId:row.search_run_id??undefined,
      tags: row.tags ?? [], evidence, evidenceDetails, budget: row.budget_signal ?? undefined, followUp: safeDate(row.follow_up_at),
      researchGaps: row.research_gaps ?? [],
      contactAvailability: row.contact_availability ?? 'unknown',
      notes: row.notes ?? '', createdAt: row.created_at,
      scoreBreakdown: scoreRow ? { relevance:scoreRow.relevance, needEvidence:scoreRow.need_evidence, budgetSignals:scoreRow.budget_signals, freshness:scoreRow.freshness, sourceConfidence:scoreRow.source_confidence } : undefined,
      duplicateOf:row.duplicate_of??undefined,
    }
  })
  const profile = profileResult.data
  const notifications:AppNotification[]=(notificationResult.data??[]).map(row=>({id:row.id,kind:row.kind,title:row.title,body:row.body,leadId:row.lead_id??undefined,readAt:row.read_at??undefined,createdAt:row.created_at}))
  const runs:SearchRun[]=(runResult.data??[]).map(row=>({id:row.id,query:row.query,status:row.status,resultCount:row.result_count,createdAt:row.created_at,finishedAt:row.finished_at??undefined,error:row.error_summary??undefined}))
  const sources:DiscoverySource[]=(sourceResult.data??[]).map(row=>{const config=typeof row.config==='object'&&row.config!==null?row.config as Record<string,unknown>:{};return{id:row.id,name:row.name,kind:row.kind,baseUrl:row.base_url??undefined,enabled:row.enabled,monthlyLimit:Number(config.monthly_limit)||1,termsReviewedAt:typeof config.terms_reviewed_at==='string'?config.terms_reviewed_at:undefined,storageRightsConfirmedAt:typeof config.storage_rights_confirmed_at==='string'?config.storage_rights_confirmed_at:undefined}})
  const role=roleResult.data?.role
  return { leads, notifications, runs, sources, role:role==='admin'||role==='super_admin'?role:'user', profile: profile ? { name: profile.display_name || user.email?.split('@')[0] || 'User', role: profile.headline || '', skills: profile.skills ?? [], services: profile.services ?? [], markets: profile.markets ?? [], portfolioLinks:profile.portfolio_links??[], experienceSummary:profile.experience_summary??'', notificationThreshold:profile.notification_threshold??65,emailNotificationsEnabled:profile.email_notifications_enabled??false } : { name: user.email?.split('@')[0] || 'User', role: '', skills: [], services: [], markets: [], portfolioLinks:[], experienceSummary:'', notificationThreshold:65,emailNotificationsEnabled:false } }
}

export async function saveCloudDiscoverySource(user:User,source:DiscoverySource){
  if(!supabase)throw new Error('Cloud mode is not configured.')
  const {error}=await supabase.from('discovery_sources').upsert({id:source.id,owner_id:user.id,name:source.name,kind:source.kind,base_url:source.baseUrl??null,enabled:source.enabled,config:{monthly_limit:source.monthlyLimit,terms_reviewed_at:source.termsReviewedAt??null,storage_rights_confirmed_at:source.storageRightsConfirmedAt??null}}, {onConflict:'id'})
  if(error)throw error
}

export async function deleteCloudDiscoverySource(user:User,id:string){
  if(!supabase)throw new Error('Cloud mode is not configured.')
  const {error:disableError}=await supabase.from('discovery_sources').update({enabled:false}).eq('owner_id',user.id).eq('id',id)
  if(disableError)throw disableError
  const {error:leadError}=await supabase.from('leads').delete().eq('owner_id',user.id).eq('source_id',id)
  if(leadError)throw leadError
  const {error:sourceError}=await supabase.from('discovery_sources').delete().eq('owner_id',user.id).eq('id',id)
  if(sourceError)throw sourceError
}

export async function saveCloudWorkspace(user: User, leads: Lead[], profile?: ProspectProfile) {
  if (!supabase) throw new Error('Cloud mode is not configured.')
  const scoreable = leads.filter(lead => lead.scoreBreakdown)
  let snapshots: {lead_id:string;score:number;relevance:number;need_evidence:number;budget_signals:number;freshness:number;source_confidence:number;explanation:{summary:string};scoring_version:string}[] = []
  if (scoreable.length) {
    const { data: oldScores, error: scoreReadError } = await supabase.from('lead_scores').select('lead_id,score,relevance,need_evidence,budget_signals,freshness,source_confidence,created_at').eq('owner_id', user.id).in('lead_id', scoreable.map(lead => lead.id)).order('created_at', { ascending: false })
    if (scoreReadError) throw scoreReadError
    const latest = new Map<string, {lead_id:string;score:number;relevance:number;need_evidence:number;budget_signals:number;freshness:number;source_confidence:number}>()
    for (const row of oldScores ?? []) if (!latest.has(row.lead_id)) latest.set(row.lead_id, row)
    snapshots = scoreable.flatMap(lead => {
      const parts = lead.scoreBreakdown!
      const old = latest.get(lead.id)
      if (old && old.score === lead.score && old.relevance === parts.relevance && old.need_evidence === parts.needEvidence && old.budget_signals === parts.budgetSignals && old.freshness === parts.freshness && old.source_confidence === parts.sourceConfidence) return []
      return [{ lead_id:lead.id, score:lead.score, relevance:parts.relevance, need_evidence:parts.needEvidence, budget_signals:parts.budgetSignals, freshness:parts.freshness, source_confidence:parts.sourceConfidence, explanation:{summary:lead.scoreReason}, scoring_version:'v1' }]
    })
  }
  const evidence = leads.flatMap(lead => {
    const items: EvidenceItem[] = lead.evidenceDetails?.length ? lead.evidenceDetails : lead.url ? lead.evidence.filter(Boolean).map(claim=>({claim,sourceUrl:lead.url,observedAt:lead.createdAt,type:'public_page',status:'unverified'})) : []
    return items.map(item=>({lead_id:lead.id,source_url:item.sourceUrl,claim:item.claim,observed_at:item.observedAt,evidence_type:item.type,verification_status:item.status,reviewed_at:item.reviewedAt??null}))
  })
  const { data, error } = await supabase.rpc('sync_workspace', {
    p_profile: profile ? {
      name: profile.name, role: profile.role, skills: profile.skills, services: profile.services, markets: profile.markets,
      portfolioLinks: profile.portfolioLinks, experienceSummary: profile.experienceSummary,
      notificationThreshold: profile.notificationThreshold, emailNotificationsEnabled: profile.emailNotificationsEnabled,
    } : null,
    p_leads: leads.map(lead => ({
      id: lead.id, kind: lead.kind.toLowerCase(), title: lead.title, organization: lead.organization,
      source_url: lead.url || null, location: lead.location || null, summary: lead.summary, status: dbStatus(lead.status),
      budget_signal: lead.budget ?? null, contact_availability: lead.contactAvailability ?? 'unknown', follow_up_at: lead.followUp ?? null,
      notes: lead.notes ?? '', duplicate_of: lead.duplicateOf ?? null, source_label: lead.source, source_id: lead.sourceId ?? null,
      search_run_id: lead.searchRunId ?? null, tags: lead.tags, research_gaps: lead.researchGaps ?? [], posted_label: lead.postedAt,
      score: lead.score, score_reason: lead.scoreReason,
    })),
    p_evidence: evidence,
    p_scores: snapshots,
  })
  if (error) throw error
  if (!data) throw new Error('Cloud workspace save did not complete.')
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

export interface AdminOperationsData {
  sources: { id:string; name:string; enabled:boolean; owner_id:string|null; kind:string; created_at:string }[]
  runs: { id:string; owner_id:string; query:string; status:string; result_count:number; created_at:string; error_summary:string|null }[]
  outbox: { id:string; owner_id:string; status:string; attempts:number; last_error_code:string|null; created_at:string; next_attempt_at:string; sent_at:string|null }[]
  audit: { id:string; actor_id:string|null; action:string; entity_type:string; entity_id:string|null; created_at:string }[]
  usage: { month_start:string; total_requests:number; active_accounts:number }[]
  queueHealth: AdminQueueHealth
}

export async function loadAdminOperations(_user:User):Promise<AdminOperationsData|null>{
  if(!supabase)throw new Error('Cloud mode is not configured.')
  const {data:allowed,error:roleError}=await supabase.rpc('is_admin')
  if(roleError)throw roleError
  if(!allowed)return null
  const [sources,runs,outbox,audit,usage,queueHealth]=await Promise.all([
    supabase.from('discovery_sources').select('id,name,enabled,owner_id,kind,created_at').order('created_at',{ascending:false}).limit(50),
    supabase.from('search_runs').select('id,owner_id,query,status,result_count,created_at,error_summary').order('created_at',{ascending:false}).limit(50),
    supabase.from('outbox').select('id,owner_id,status,attempts,last_error_code,created_at,next_attempt_at,sent_at').order('created_at',{ascending:false}).limit(50),
    supabase.from('audit_logs').select('id,actor_id,action,entity_type,entity_id,created_at').order('created_at',{ascending:false}).limit(50),
    supabase.rpc('admin_discovery_usage'),
    supabase.rpc('admin_queue_health'),
  ])
  for(const result of [sources,runs,outbox,audit,usage,queueHealth])if(result.error)throw result.error
  const health = queueHealth.data?.[0]
  return {
    sources:sources.data??[], runs:runs.data??[], outbox:outbox.data??[], audit:audit.data??[], usage:usage.data??[],
    queueHealth: health ?? { queued_count: 0, oldest_queued_at: null, stale_sending_count: 0, failed_count: 0 },
  }
}

export async function requeueFailedNotification(id:string){
  if(!supabase)throw new Error('Cloud mode is not configured.')
  const {data,error}=await supabase.rpc('admin_retry_notification_outbox',{p_id:id})
  if(error)throw error
  return data
}

export async function setAdminDiscoverySourceEnabled(id:string,enabled:boolean){
  if(!supabase)throw new Error('Cloud mode is not configured.')
  const {data,error}=await supabase.rpc('admin_set_discovery_source_enabled',{p_id:id,p_enabled:enabled})
  if(error)throw error
  return data
}

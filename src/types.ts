export type LeadStatus = 'New' | 'Reviewed' | 'Shortlisted' | 'Contacted' | 'Applied' | 'Replied' | 'Interviewing' | 'Won' | 'Lost' | 'Dismissed'
export type LeadKind = 'Opportunity' | 'Company'
export interface ScoreBreakdown { relevance:number; needEvidence:number; budgetSignals:number; freshness:number; sourceConfidence:number }
export interface AppNotification { id:string; kind:string; title:string; body:string; createdAt:string; readAt?:string; leadId?:string }
export interface SearchRun { id:string; query:string; status:string; resultCount:number; createdAt:string; finishedAt?:string; error?:string }
export interface Lead { id:string; title:string; organization:string; kind:LeadKind; url:string; location:string; postedAt:string; summary:string; status:LeadStatus; score:number; scoreReason:string; source:string; tags:string[]; evidence:string[]; budget?:string; followUp?:string; notes?:string; createdAt:string; scoreBreakdown?:ScoreBreakdown; duplicateOf?:string }
export interface ProspectProfile { name:string; role:string; skills:string[]; services:string[]; markets:string[]; portfolioLinks:string[]; experienceSummary:string; notificationThreshold:number }

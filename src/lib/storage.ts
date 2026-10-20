import type { AppNotification, Lead, ProspectProfile, SearchRun } from '../types'
import { initialProfile, seedLeads } from '../data'
const L='prospect-ai.leads.v1',P='prospect-ai.profile.v1',N='prospect-ai.notices.v1',R='prospect-ai.runs.v1'
export function readLeads():Lead[]{try{const r=localStorage.getItem(L);return r?JSON.parse(r) as Lead[]:seedLeads}catch{return seedLeads}}
export function saveLeads(x:Lead[]){localStorage.setItem(L,JSON.stringify(x))}
export function readProfile():ProspectProfile{try{const r=localStorage.getItem(P);return r?{...initialProfile,...JSON.parse(r) as Partial<ProspectProfile>}:initialProfile}catch{return initialProfile}}
export function saveProfile(x:ProspectProfile){localStorage.setItem(P,JSON.stringify(x))}
export function readNoticeCount(){return Number(localStorage.getItem(N)??3)}
export function clearNoticeCount(){localStorage.setItem(N,'0')}
export function readNotices():AppNotification[]{try{const raw=localStorage.getItem(N);if(raw&&raw.startsWith('['))return JSON.parse(raw) as AppNotification[]}catch{}return[{id:'tip-welcome',kind:'tip',title:'Welcome to Prospect AI',body:'Sample records are local examples. Replace them with verified public sources as you research.',createdAt:new Date().toISOString()},{id:'tip-score',kind:'tip',title:'Your fit score is explainable',body:'Scores combine relevance, evidence of need, budget signals, freshness, and source confidence.',createdAt:new Date().toISOString()},{id:'tip-email',kind:'configuration',title:'Email alerts are off',body:'Connect an email provider to enable optional alerts.',createdAt:new Date().toISOString()}]}
export function saveNotices(x:AppNotification[]){localStorage.setItem(N,JSON.stringify(x))}
export function readRuns():SearchRun[]{try{return JSON.parse(localStorage.getItem(R)??'[]') as SearchRun[]}catch{return[]}}
export function saveRuns(x:SearchRun[]){localStorage.setItem(R,JSON.stringify(x))}
export function newId(){
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID()
  if(globalThis.crypto?.getRandomValues){const bytes=globalThis.crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`}
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12,'0').slice(-12)}`
}

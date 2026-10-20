import type { Lead, ProspectProfile } from '../types'
import { initialProfile, seedLeads } from '../data'
const L='prospect-ai.leads.v1',P='prospect-ai.profile.v1',N='prospect-ai.notices.v1'
export function readLeads():Lead[]{try{const r=localStorage.getItem(L);return r?JSON.parse(r) as Lead[]:seedLeads}catch{return seedLeads}}
export function saveLeads(x:Lead[]){localStorage.setItem(L,JSON.stringify(x))}
export function readProfile():ProspectProfile{try{const r=localStorage.getItem(P);return r?JSON.parse(r) as ProspectProfile:initialProfile}catch{return initialProfile}}
export function saveProfile(x:ProspectProfile){localStorage.setItem(P,JSON.stringify(x))}
export function readNoticeCount(){return Number(localStorage.getItem(N)??3)}
export function clearNoticeCount(){localStorage.setItem(N,'0')}
export function newId(){return globalThis.crypto?.randomUUID?.()??('lead-'+Date.now())}
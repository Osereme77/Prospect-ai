import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateScore, scoreLead } from '../src/lib/scoring.ts'
import { canonicalPublicUrl } from '../src/lib/urls.ts'
import { leadsToCsv } from '../src/lib/export.ts'
import { filterLeads } from '../src/lib/filters.ts'
import { normalizeBraveResults } from '../supabase/functions/_shared/discovery.ts'
import { buildSuggestedQuery } from '../src/lib/query.ts'

test('score uses the documented weights and rounds to an integer', () => {
  assert.equal(calculateScore({ relevance: 100, needEvidence: 80, budgetSignals: 50, freshness: 60, sourceConfidence: 90 }), 81)
})

test('score rejects inputs outside the 0 to 100 range', () => {
  assert.throws(() => calculateScore({ relevance: 101, needEvidence: 0, budgetSignals: 0, freshness: 0, sourceConfidence: 0 }))
})

test('unknown budget is neutral and the rationale labels uncertain evidence', () => {
  const result = scoreLead('React engineer for a web application', ['React'], ['Web application development'], true, true)
  assert.equal(result.breakdown.budgetSignals, 50)
  assert.equal(result.score, calculateScore(result.breakdown))
  assert.match(result.explanation, /budget unknown/)
  assert.match(result.explanation, /unverified/)
})

test('public URL canonicalization removes tracking parameters and fragments', () => {
  assert.equal(canonicalPublicUrl('https://Example.com/jobs/role/?utm_source=mail&ref=board#apply'), 'https://example.com/jobs/role?ref=board')
})

test('public URL validation rejects credentials, private hosts, and non-web protocols', () => {
  assert.equal(canonicalPublicUrl('https://user:secret@example.com/job'), null)
  assert.equal(canonicalPublicUrl('http://192.168.1.1/admin'), null)
  assert.equal(canonicalPublicUrl('file:///etc/passwd'), null)
})

test('CSV export quotes commas, quotes, and newlines without losing fields', () => {
  const csv = leadsToCsv([{id:'1',kind:'Opportunity',title:'Senior "React", engineer',organization:'A,B',status:'New',score:80,scoreReason:'reason\nnext',source:'manual',url:'https://example.com',location:'Remote',tags:['React','Node'],evidence:[],summary:'line 1\nline 2',createdAt:'2026-10-20T00:00:00.000Z'}])
  assert.match(csv, /"Senior ""React"", engineer"/)
  assert.match(csv, /"A,B"/)
  assert.match(csv, /"reason\nnext"/)
})

const filterSample = (overrides = {}) => ({id:'lead-1',kind:'Opportunity',title:'React workflow engineer',organization:'Example Labs',url:'https://example.com/job',location:'Lagos, Nigeria',postedAt:'Today',summary:'Build a React and Node workflow',status:'New',score:82,scoreReason:'reason',source:'Company site',tags:['React','TypeScript'],evidence:[],budget:'Not disclosed',createdAt:'2026-10-19T12:00:00.000Z',...overrides})

test('lead filters compose across status, score, source, service, location, and budget knowledge', () => {
  const leads = [filterSample(), filterSample({id:'lead-2',status:'Reviewed',score:60,source:'Board',tags:['Vue'],budget:'USD 2,000'})]
  assert.deepEqual(filterLeads(leads,{status:'New',minScore:80,source:'Company site',service:'react',location:'lagos',budget:'unknown'}).map(x=>x.id),['lead-1'])
  assert.deepEqual(filterLeads(leads,{budget:'known'}).map(x=>x.id),['lead-2'])
})

test('lead filters support recent records and unread notifications', () => {
  const leads = [filterSample(),filterSample({id:'lead-old',createdAt:'2026-08-01T12:00:00.000Z'})]
  const notices = [{id:'n1',kind:'lead_match',title:'Match',body:'Review',createdAt:'2026-10-20T00:00:00.000Z',leadId:'lead-1'}]
  assert.deepEqual(filterLeads(leads,{withinDays:7,unreadOnly:true},notices,Date.parse('2026-10-20T12:00:00.000Z')).map(x=>x.id),['lead-1'])
  assert.deepEqual(filterLeads(leads,{unreadOnly:true},[{...notices[0],readAt:'2026-10-20T01:00:00.000Z'}]).map(x=>x.id),[])
})

test('Brave adapter normalizes bounded evidence and filters unsafe result URLs', () => {
  const results = normalizeBraveResults({web:{results:[
    {title:'A'.repeat(400),url:'https://example.com/job?utm_source=test',description:'B'.repeat(2000)},
    {title:'Private',url:'http://127.0.0.1/admin',description:'internal'},
    {title:'Credential URL',url:'https://user:pass@example.com/job',description:'private'},
    {title:'Invalid',url:'javascript:alert(1)',description:'unsafe'},
    {title:'Missing URL',description:'skip'},
  ]}})
  assert.equal(results.length,1)
  assert.equal(results[0].title.length,300)
  assert.equal(results[0].snippet.length,1500)
  assert.equal(results[0].source,'Brave Search')
  assert.equal(results[0].url,'https://example.com/job?utm_source=test')
})

test('discovery query suggestions combine unique profile skills, services, and a target market', () => {
  assert.equal(buildSuggestedQuery(['React',' TypeScript ','react','Node.js','Python','Go'],['Web application development','AI automation','Extra service'],['Nigeria','Global']), 'React TypeScript Node.js Python Web application development AI automation Nigeria')
  assert.equal(buildSuggestedQuery(['  ',''],[],[]), '')
})

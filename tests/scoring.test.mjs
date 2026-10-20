import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateScore, scoreLead } from '../src/lib/scoring.ts'
import { canonicalPublicUrl } from '../src/lib/urls.ts'
import { leadsToCsv } from '../src/lib/export.ts'

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

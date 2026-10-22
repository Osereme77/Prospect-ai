import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { dialogTabWrapTarget } from '../src/lib/dialogFocus.ts'
import { tryStorageWrite } from '../src/lib/storageWrite.ts'

const css = await readFile(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')

test('browser storage write failures are reported without escaping', () => {
  let calls = 0
  assert.equal(tryStorageWrite(() => { calls += 1 }), true)
  assert.equal(calls, 1)
  assert.equal(tryStorageWrite(() => { throw new Error('quota exceeded') }), false)
})

function token(name) {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))
  assert.ok(match, `missing color token --${name}`)
  return match[1]
}

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrast(foreground, background) {
  const first = luminance(foreground)
  const second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

test('normal-text semantic colors meet WCAG AA contrast against their surfaces', () => {
  const white = '#ffffff'
  const pairs = [
    ['color-text', 'color-canvas'],
    ['color-text-muted', 'color-surface'],
    ['color-primary', 'color-surface'],
    ['color-success', 'color-success-soft'],
    ['color-caution', 'color-caution-soft'],
    ['color-danger', 'color-danger-soft'],
  ]

  for (const [foregroundName, backgroundName] of pairs) {
    const ratio = contrast(token(foregroundName), token(backgroundName))
    assert.ok(ratio >= 4.5, `--${foregroundName} on --${backgroundName} has contrast ${ratio.toFixed(2)}:1`)
  }
  assert.ok(contrast(white, token('color-primary')) >= 4.5, 'white text on primary buttons must meet 4.5:1')
})

test('generic muted copy uses the shared contrast token instead of pale gray literals', () => {
  const paleTextColors = [
    '#9293a2', '#9999a7', '#a4a5b0', '#737587', '#77738e', '#858696',
    '#a0a1ad', '#7e7f8e', '#9999a6', '#90909e', '#999', '#898997', '#777',
    '#9c9ca9', '#8a8a98', '#777989', '#757585', '#9797a4',
    '#77798a', '#878899', '#8a82a6',
  ]
  const declarations = [...styles.matchAll(/(?:^|[;{])\s*color\s*:\s*(#[\da-f]{3,8}|var\([^)]*\))/gi)]
  for (const color of paleTextColors) {
    assert.ok(
      !declarations.some(([, value]) => value.toLowerCase() === color),
      `replace generic text color ${color} with a reviewed semantic token`,
    )
  }
})

test('links opened in new tabs prevent access to the opener window', () => {
  const links = [...app.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)].map(([tag]) => tag)
  assert.ok(links.length > 0, 'expected external links that open in a new tab')
  for (const link of links) assert.match(link, /\brel="[^"]*(?:noopener|noreferrer)[^"]*"/)
})

test('dialog keyboard navigation wraps at both ends and leaves middle focus alone', () => {
  const first = { focus() {} }, middle = { focus() {} }, last = { focus() {} }
  const members = new Set([first, middle, last])
  const dialog = { contains: node => members.has(node) }
  const focusable = [first, middle, last]
  assert.equal(dialogTabWrapTarget(first, focusable, true, dialog), last)
  assert.equal(dialogTabWrapTarget(last, focusable, false, dialog), first)
  assert.equal(dialogTabWrapTarget(middle, focusable, false, dialog), undefined)
  assert.equal(dialogTabWrapTarget(null, focusable, true, dialog), last)
  assert.equal(dialogTabWrapTarget(null, focusable, false, dialog), first)
  assert.equal(dialogTabWrapTarget(first, [], false, dialog), undefined)
})

test('mobile navigation exposes its state and supports keyboard dismissal', () => {
  assert.match(app, /aria-controls="primary-navigation" aria-expanded=\{mobile\}/)
  assert.match(app, /aria-label="Primary navigation" aria-hidden=\{smallScreen&&!mobile\} inert=\{smallScreen&&!mobile\}/)
  assert.match(app, /if\(event\.key==='Escape'\)\{setMobile\(false\);navToggleRef\.current\?\.focus\(\)\}/)
})

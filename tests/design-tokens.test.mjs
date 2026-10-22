import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const css = await readFile(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')

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

test('links opened in new tabs prevent access to the opener window', () => {
  const links = [...app.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)].map(([tag]) => tag)
  assert.ok(links.length > 0, 'expected external links that open in a new tab')
  for (const link of links) assert.match(link, /\brel="[^"]*(?:noopener|noreferrer)[^"]*"/)
})

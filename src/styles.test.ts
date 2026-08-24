import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Guards the one thing about the token sheet that a build will not shout
 * about: Tailwind hoists every `@theme` block to the top level, so putting one
 * inside a media query silently makes those values unconditional — and the
 * whole app renders in the dark palette regardless of the reader's setting.
 */
const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8')

/** The `@media (prefers-color-scheme: dark)` block, without its trailing brace. */
function darkSchemeBlock(): string {
  const start = css.indexOf('@media (prefers-color-scheme: dark)')
  expect(start).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('\n}', start))
}

describe('design tokens', () => {
  it('declares the light palette in the theme, unconditionally', () => {
    const theme = css.slice(css.indexOf('@theme'), css.indexOf('\n}'))
    expect(theme).toContain('--color-surface: #ffffff')
    expect(theme).toContain('--color-ink: #16211c')
    expect(theme).toContain('--color-moss: #0b6e4f')
  })

  it('overrides the same tokens for a dark scheme', () => {
    const dark = darkSchemeBlock()
    expect(dark).toContain('--color-surface: #18211d')
    expect(dark).toContain('--color-ink: #e7ede6')
    expect(dark).toContain('--color-moss: #4fbf92')
  })

  it('never nests an @theme inside the dark scheme, which would hoist out of it', () => {
    expect(darkSchemeBlock()).not.toContain('@theme')
  })
})

import { describe, expect, it } from 'vitest'

import { HEAD_LINKS } from './__root'

/** The `links` the root route puts in the document head. */
function headLinks(): {
  rel?: string | undefined
  href?: string | undefined
}[] {
  return HEAD_LINKS
}

describe('root document head', () => {
  it('loads Archivo and IBM Plex Mono from Google Fonts', () => {
    const fontHrefs = headLinks()
      .filter((link) => link.rel === 'stylesheet')
      .map((link) => link.href ?? '')
      .filter((href) => href.includes('fonts.googleapis.com'))
      .join(' ')

    expect(fontHrefs).toMatch(/Archivo/)
    expect(fontHrefs).toMatch(/IBM\+Plex\+Mono/)
  })

  it('preconnects to the Google Fonts hosts so the first paint has the faces', () => {
    const preconnected = headLinks()
      .filter((link) => link.rel === 'preconnect')
      .map((link) => link.href)

    expect(preconnected).toContain('https://fonts.googleapis.com')
    expect(preconnected).toContain('https://fonts.gstatic.com')
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildGpxDocument, downloadGpx } from './gpx'

describe('buildGpxDocument', () => {
  it('includes one trkpt per coordinate, in order, with matching lat/lon', () => {
    const candidate = {
      coordinates: [
        [52.52, 13.405],
        [52.525, 13.41],
        [52.52, 13.405],
      ] as [number, number][],
    }

    const gpx = buildGpxDocument(candidate)

    const trkpts = [...gpx.matchAll(/<trkpt lat="([^"]+)" lon="([^"]+)"/g)]
    expect(trkpts).toHaveLength(candidate.coordinates.length)
    expect(trkpts.map((match) => [Number(match[1]), Number(match[2])])).toEqual(
      candidate.coordinates,
    )
  })

  it('produces well-formed XML with a gpx root containing a single trk/trkseg', () => {
    const candidate = {
      coordinates: [
        [48.2082, 16.3738],
        [48.21, 16.375],
      ] as [number, number][],
    }

    const gpx = buildGpxDocument(candidate)
    const doc = new DOMParser().parseFromString(gpx, 'application/xml')

    expect(doc.querySelector('parsererror')).toBeNull()
    expect(doc.documentElement.tagName).toBe('gpx')
    expect(doc.querySelectorAll('trk')).toHaveLength(1)
    expect(doc.querySelectorAll('trkseg')).toHaveLength(1)

    const trkpts = doc.querySelectorAll('trkpt')
    expect(trkpts).toHaveLength(2)
    expect(trkpts[0]?.getAttribute('lat')).toBe('48.2082')
    expect(trkpts[0]?.getAttribute('lon')).toBe('16.3738')
  })

  it('declares the GPX 1.1 namespace and version on the root element, per the GPX schema', () => {
    const gpx = buildGpxDocument({
      coordinates: [[0, 0]],
    })
    const doc = new DOMParser().parseFromString(gpx, 'application/xml')

    expect(doc.documentElement.getAttribute('xmlns')).toBe(
      'http://www.topografix.com/GPX/1/1',
    )
    expect(doc.documentElement.getAttribute('version')).toBe('1.1')
  })
})

describe('downloadGpx', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('triggers a browser download of the candidate as a .gpx file via an object URL anchor click', () => {
    const candidate = {
      coordinates: [
        [52.52, 13.405],
        [52.525, 13.41],
      ] as [number, number][],
    }

    const createObjectURLSpy = vi.fn((_blob: Blob) => 'blob:mock-url')
    const revokeObjectURLSpy = vi.fn()
    URL.createObjectURL = createObjectURLSpy
    URL.revokeObjectURL = revokeObjectURLSpy
    const clickSpy = vi.fn()
    const anchor = document.createElement('a')
    vi.spyOn(anchor, 'click').mockImplementation(clickSpy)
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)

    downloadGpx(candidate, 'candidate-1.gpx')

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    const call = createObjectURLSpy.mock.calls[0]
    if (!call) {
      throw new Error('expected createObjectURL to have been called')
    }
    expect(call[0].type).toBe('application/gpx+xml')
    expect(anchor.href).toBe('blob:mock-url')
    expect(anchor.download).toBe('candidate-1.gpx')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
  })
})

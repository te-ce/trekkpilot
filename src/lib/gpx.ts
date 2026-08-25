export type GpxExportableCandidate = {
  /** [lat, lon] pairs, in order, exactly as scored/displayed (issue 002-004). */
  coordinates: [number, number][]
}

export function buildGpxDocument(candidate: GpxExportableCandidate): string {
  const trkpts = candidate.coordinates
    .map(([lat, lon]) => `<trkpt lat="${lat}" lon="${lon}"></trkpt>`)
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="TrekkPilot" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>TrekkPilot route</name><trkseg>${trkpts}</trkseg></trk></gpx>`
}

/**
 * Builds the GPX document for `candidate` and triggers a browser download of
 * it as `filename`, via the standard Blob + object URL + programmatic
 * `<a download>` click pattern. DOM-heavy by nature, so only the observable
 * effects (blob contents/type, anchor href/download, click) are asserted in
 * tests rather than the underlying browser download mechanics.
 */
export function downloadGpx(
  candidate: GpxExportableCandidate,
  filename: string,
): void {
  const gpx = buildGpxDocument(candidate)
  const blob = new Blob([gpx], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()

  URL.revokeObjectURL(url)
}

function gpxFile(candidate: GpxExportableCandidate, filename: string): File {
  return new File([buildGpxDocument(candidate)], filename, {
    type: 'application/gpx+xml',
  })
}

/**
 * True when the platform's share sheet can take a GPX file — the Web Share
 * API (Level 2) file support that Komoot's "open with" integration relies on.
 * Absent on desktop browsers, so callers fall back to `downloadGpx`.
 */
export function canShareGpx(): boolean {
  if (!('canShare' in navigator)) {
    return false
  }
  return navigator.canShare({
    files: [new File([''], 'probe.gpx', { type: 'application/gpx+xml' })],
  })
}

/** Opens the share sheet with the candidate's GPX file, e.g. to hand it to Komoot. */
export function shareGpx(
  candidate: GpxExportableCandidate,
  filename: string,
): Promise<void> {
  return navigator.share({ files: [gpxFile(candidate, filename)] })
}

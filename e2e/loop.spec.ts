import { readFile } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'

import { loopCandidateSpecs, specNamed } from './fixtures/orsFixtures'

/**
 * The loop journey, end to end against the fixture ORS server: search from a
 * position, read the three options, re-rank them, pick one, and get it out of
 * the app as a file or a link.
 */

// Berlin Mitte, the centre the loop fixtures are drawn around.
test.use({
  geolocation: { latitude: 52.52, longitude: 13.405 },
  permissions: ['geolocation'],
})

/**
 * The fixture pool, by the part each loop plays. The server scores and sorts
 * all five and hands the whole pool over; the sheet reveals the best three,
 * and the ranking control re-ranks the pool, so a loop below the fold can
 * still come first under another ranking.
 */
const bestLoop = specNamed(loopCandidateSpecs, 'easy river loop')
const pathHeavyLoop = specNamed(loopCandidateSpecs, 'hilly park loop')
const flattestLoop = specNamed(loopCandidateSpecs, 'short flat loop')
const roadworksLoop = specNamed(loopCandidateSpecs, 'roadworks loop')

/** Reveals the free-form minutes field, which the duration presets fold away. */
async function openCustomDuration(page: Page) {
  await page.getByRole('group', { name: 'Duration' }).getByText('Other').click()
  await expect(page.getByLabel(/duration/i)).toBeVisible()
}

async function searchLoopsFromCurrentPosition(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /use my current location/i }).click()
  await page.getByRole('button', { name: /find 3 routes/i }).click()
  await expect(page.getByTestId('candidate-row')).toHaveCount(3)
}

test('a loop search offers three candidates with distance and time @smoke', async ({
  page,
}) => {
  await searchLoopsFromCurrentPosition(page)

  // Three of the five the fixture server scored: the rest are one tap away.
  await expect(
    page.getByRole('heading', { name: 'Showing 3 of 5 loops from here' }),
  ).toBeVisible()

  const rows = page.getByTestId('candidate-row')
  await expect(rows.nth(0)).toContainText('14.8 km')
  await expect(rows.nth(0)).toContainText('59 min')
  await expect(rows.nth(1)).toContainText('15.5 km')
  await expect(rows.nth(1)).toContainText('1 h 5 min')
  await expect(rows.nth(2)).toContainText('12.3 km')
  await expect(rows.nth(2)).toContainText('50 min')
})

/**
 * The presets are the one-tap answer, not the only answer: "Other" still opens
 * a free-form number of minutes. 47 minutes is deliberately not a round number:
 * the derived distance has to follow it, and the search has to run on it.
 */
test('an arbitrary duration is searchable @smoke', async ({ page }) => {
  await page.goto('/')

  // Exact: "1h" is otherwise a prefix of the "1h30" chip beside it.
  await expect(
    page.getByRole('radio', { name: '1h', exact: true }),
  ).toBeChecked()
  await expect(page.getByLabel(/duration/i)).toBeHidden()

  await openCustomDuration(page)
  await page.getByLabel(/duration/i).fill('47')
  await expect(page.getByText('≈ 11.8 km at 15 km/h')).toBeVisible()

  await page.getByRole('button', { name: /use my current location/i }).click()
  await page.getByRole('button', { name: /find 3 routes/i }).click()

  await expect(page.getByTestId('candidate-row')).toHaveCount(3)
  // And the plan pill words those 47 minutes as time, not as a minute count.
  await expect(
    page.getByRole('button', { name: /Cycling · 47 min/ }),
  ).toBeVisible()
})

test('a duration of zero is refused instead of searched', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: /use my current location/i }).click()
  await openCustomDuration(page)
  await page.getByLabel(/duration/i).fill('0')
  await page.getByRole('button', { name: /find 3 routes/i }).click()

  await expect(page.getByText(/more than 0 minutes/i)).toBeVisible()
  await expect(page.getByTestId('candidate-row')).toHaveCount(0)

  await page.getByLabel(/duration/i).fill('120')
  await page.getByRole('button', { name: /find 3 routes/i }).click()
  await expect(page.getByTestId('candidate-row')).toHaveCount(3)
})

test('the roadworks-heavy loop never reaches the list', async ({ page }) => {
  await searchLoopsFromCurrentPosition(page)

  // Its 30% construction share costs it more than its other merits earn.
  await expect(page.getByTestId('candidate-row').first()).toBeVisible()
  await expect(
    page.getByTestId('candidate-row').filter({ hasText: '14.1 km' }),
  ).toHaveCount(0)
  expect(roadworksLoop.constructionPercent).toBeGreaterThan(0)
})

test('ranking by flattest reorders the same three candidates @smoke', async ({
  page,
}) => {
  await searchLoopsFromCurrentPosition(page)

  const rows = page.getByTestId('candidate-row')
  await expect(rows.nth(0)).toContainText('14.8 km')

  await page.getByLabel('Rank by').selectOption('flat')

  // The least climbing of the whole pool moves to the top — including a loop
  // the balanced ranking kept below the fold. Nothing is refetched.
  await expect(rows.nth(0)).toContainText('9.8 km')
  await expect(rows).toHaveCount(3)
  expect(flattestLoop.ascentMeters).toBeLessThan(bestLoop.ascentMeters)

  await page.getByLabel('Rank by').selectOption('paths')

  // And the most bike path is a different route again.
  await expect(rows.nth(0)).toContainText('15.5 km')
  expect(pathHeavyLoop.pathPercent).toBeGreaterThan(bestLoop.pathPercent)
})

test('picking a candidate makes it the active route @smoke', async ({
  page,
}) => {
  await searchLoopsFromCurrentPosition(page)

  await page.getByTestId('candidate-row').first().click()

  await expect(page.getByRole('heading', { name: 'Route #1' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: /start this loop/i }),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: 'Your route' })).toContainText(
    '14.8 km',
  )
})

test('the active route exports as GPX matching the fixture geometry', async ({
  page,
}) => {
  await searchLoopsFromCurrentPosition(page)
  await page.getByTestId('candidate-row').first().click()

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: /download gpx/i }).click()
  const download = await downloading

  expect(download.suggestedFilename()).toBe('trekkpilot-route-1.gpx')

  const gpx = await readFile(await download.path(), 'utf8')

  expect(gpx).toContain('<gpx version="1.1" creator="TrekkPilot"')
  expect(gpx).toContain('<trk><name>TrekkPilot route</name><trkseg>')
  // One trkpt per coordinate of the loop the fixture server returned.
  expect(gpx.match(/<trkpt /g) ?? []).toHaveLength(bestLoop.pointCount)
})

test('the active route links out to Google Maps', async ({ page }) => {
  await searchLoopsFromCurrentPosition(page)
  await page.getByTestId('candidate-row').first().click()

  const href = await page
    .getByRole('link', { name: /open in google maps/i })
    .getAttribute('href')

  expect(href).toContain('google.com/maps/dir/')
  const url = new URL(href ?? '')
  expect(url.searchParams.get('origin')).toMatch(/^52\.\d+,13\.\d+$/)
  expect(url.searchParams.get('destination')).toMatch(/^52\.\d+,13\.\d+$/)
})

test('a picked route lands in history and can be reopened', async ({
  page,
}) => {
  await searchLoopsFromCurrentPosition(page)
  await page.getByTestId('candidate-row').first().click()
  await expect(page.getByRole('heading', { name: 'Route #1' })).toBeVisible()

  await page.getByRole('button', { name: 'History' }).click()

  const entries = page.getByTestId('history-entry')
  await expect(entries).toHaveCount(1)
  await expect(entries.first()).toContainText('14.8 km')
  await expect(entries.first()).toContainText('Cycling')

  await entries.first().click()

  await expect(
    page.getByRole('heading', { name: /^Saved \d{4}-\d{2}-\d{2}/ }),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: 'Your route' })).toContainText(
    '14.8 km',
  )
})

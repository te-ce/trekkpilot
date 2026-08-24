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

/** The three loops the fixture server's scores leave standing, best first. */
const bestLoop = specNamed(loopCandidateSpecs, 'easy river loop')
const pathHeavyLoop = specNamed(loopCandidateSpecs, 'hilly park loop')
const flattestSurvivingLoop = specNamed(loopCandidateSpecs, 'twisty canal loop')
const roadworksLoop = specNamed(loopCandidateSpecs, 'roadworks loop')

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

  await expect(
    page.getByRole('heading', { name: '3 loops from here' }),
  ).toBeVisible()

  const rows = page.getByTestId('candidate-row')
  await expect(rows.nth(0)).toContainText('14.8 km')
  await expect(rows.nth(0)).toContainText('59 min')
  await expect(rows.nth(1)).toContainText('15.5 km')
  await expect(rows.nth(1)).toContainText('1 h 5 min')
  await expect(rows.nth(2)).toContainText('12.3 km')
  await expect(rows.nth(2)).toContainText('50 min')
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

  // The least climbing of the three moves to the top; nothing is refetched.
  await expect(rows.nth(0)).toContainText('12.3 km')
  await expect(rows).toHaveCount(3)
  expect(flattestSurvivingLoop.ascentMeters).toBeLessThan(bestLoop.ascentMeters)

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

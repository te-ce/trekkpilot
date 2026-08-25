import { readFile } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'

import {
  alternativeRouteSpecs,
  GEOCODABLE_PLACES,
  specNamed,
} from './fixtures/orsFixtures'

/**
 * The point-to-point journey: name two places, and rank the ways between
 * them. This is the only path that touches geocoding and ORS's
 * `alternative_routes`, so it is what proves those two fixtures are wired up.
 */

/** The alternatives the fixture server returns, in the order their scores put them. */
const bestAlternative = specNamed(
  alternativeRouteSpecs,
  'alternative via the bike path',
)
const middleAlternative = specNamed(
  alternativeRouteSpecs,
  'alternative via the canal',
)

/**
 * The mode chips are real radios behind sr-only inputs, so a person clicks the
 * label, not the input — and so does this.
 */
async function chooseAToBMode(page: Page) {
  await page
    .getByRole('group', { name: 'Shape' })
    .getByText('A→B', { exact: true })
    .click()
  await expect(page.getByRole('radio', { name: 'A→B' })).toBeChecked()
}

async function searchPlace(page: Page, field: 'start' | 'stop', query: string) {
  const picker = page.getByRole('group', {
    name: field === 'start' ? 'Start point' : 'Stop point',
  })
  // The start point has the map and GPS to fall back on, so its search sits
  // folded behind a button; the stop point has neither, so its is already open.
  const reveal = picker.getByRole('button', {
    name: 'Search or enter coordinates',
  })
  if ((await reveal.getAttribute('aria-expanded')) === 'false') {
    await reveal.click()
  }
  await picker
    .getByRole('searchbox', { name: /search for a place/i })
    .fill(query)
  await picker.getByRole('button', { name: 'Search', exact: true }).click()
}

test('a point-to-point search ranks the alternatives between two named places @smoke', async ({
  page,
}) => {
  await page.goto('/')

  await chooseAToBMode(page)

  await searchPlace(page, 'start', GEOCODABLE_PLACES.start.query)
  await expect(
    page.getByText(GEOCODABLE_PLACES.start.label).first(),
  ).toBeVisible()

  await searchPlace(page, 'stop', GEOCODABLE_PLACES.stop.query)
  await expect(
    page.getByText(GEOCODABLE_PLACES.stop.label).first(),
  ).toBeVisible()

  await page.getByRole('button', { name: /find 3 routes/i }).click()

  await expect(
    page.getByRole('heading', { name: '3 routes to your stop' }),
  ).toBeVisible()
  const rows = page.getByTestId('candidate-row')
  await expect(rows).toHaveCount(3)

  // Best score first: most bike path, least climbing, despite being longest.
  await expect(rows.nth(0)).toContainText('9.1 km')
  await expect(rows.nth(1)).toContainText('8.2 km')
  await expect(rows.nth(2)).toContainText('7.6 km')
  expect(bestAlternative.pathPercent).toBeGreaterThan(
    middleAlternative.pathPercent,
  )
})

test('a point-to-point route can be picked and exported', async ({ page }) => {
  await page.goto('/')
  await chooseAToBMode(page)
  await searchPlace(page, 'start', GEOCODABLE_PLACES.start.query)
  await searchPlace(page, 'stop', GEOCODABLE_PLACES.stop.query)
  await page.getByRole('button', { name: /find 3 routes/i }).click()

  await page.getByTestId('candidate-row').first().click()

  await expect(
    page.getByRole('button', { name: /start this route/i }),
  ).toBeVisible()

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: /download gpx/i }).click()
  const download = await downloading

  expect(download.suggestedFilename()).toMatch(/^trekkpilot-route-\d+\.gpx$/)

  const gpx = await readFile(await download.path(), 'utf8')
  // The alternative_routes fixture's own geometry, point for point.
  expect(gpx.match(/<trkpt /g) ?? []).toHaveLength(bestAlternative.pointCount)
})

test('an unknown place name surfaces as an error rather than a search', async ({
  page,
}) => {
  await page.goto('/')

  await searchPlace(page, 'start', 'Nowhere At All')

  await expect(page.getByRole('alert')).toContainText(
    'Could not find a location for "Nowhere At All"',
  )
})

import { expect, test } from '@playwright/test'

test('home page loads with the map and the plan sheet @smoke', async ({
  page,
}) => {
  await page.goto('/')

  // The app name is there for assistive tech; the plan is what a person sees.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/TrekkPilot/)
  await expect(
    page.getByRole('button', { name: /find 3 routes/i }),
  ).toBeVisible()
})

/**
 * Where you are on the map, against a real Leaflet instance. The unit tests
 * mock `react-leaflet` wholesale, so only a browser can show that a genuine
 * drag gesture fires `dragstart` — and, just as importantly, that following's
 * own `setView` does not, which would make follow cancel itself on the first
 * GPS fix.
 */
test.describe('my position on the map', () => {
  // Berlin Mitte, the same centre the route fixtures are drawn around.
  test.use({
    geolocation: { latitude: 52.52, longitude: 13.405 },
    permissions: ['geolocation'],
  })

  test('centres on the current position without needing a route', async ({
    page,
  }) => {
    await page.goto('/')

    await page
      .getByRole('button', { name: /centre the map on my location/i })
      .click()

    // The dot is a Leaflet circle marker: an SVG path in the overlay pane.
    await expect(
      page.locator('.leaflet-overlay-pane path').first(),
    ).toBeVisible()
    // Centring is not choosing a start point.
    await expect(
      page.getByRole('button', { name: /set a start point/i }),
    ).toBeVisible()
  })

  test('stops following once the user drags the map', async ({ page }) => {
    await page.goto('/')

    const followButton = page.getByRole('button', {
      name: /follow my position/i,
    })
    await followButton.click()
    await expect(followButton).toHaveAttribute('aria-pressed', 'true')

    // The live dot proves a fix has landed, so following has already recentred
    // the map at least once by the time we drag.
    await expect(
      page.locator('.leaflet-overlay-pane path').first(),
    ).toBeVisible()
    await expect(followButton).toHaveAttribute('aria-pressed', 'true')

    const map = page.locator('.leaflet-container')
    const box = await map.boundingBox()
    if (!box) {
      throw new Error('the map has no box to drag')
    }
    // Below the pill bar, above the sheet: somewhere a thumb could actually pan.
    const x = box.x + box.width / 2
    const y = box.y + 150
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 120, y - 60, { steps: 10 })
    await page.mouse.up()

    await expect(followButton).toHaveAttribute('aria-pressed', 'false')
  })
})

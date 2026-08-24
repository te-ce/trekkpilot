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

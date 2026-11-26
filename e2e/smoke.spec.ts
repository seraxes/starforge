import { expect, test } from '@playwright/test'

import { signInAsSeedAdmin } from './helpers/auth'
import { assertNoPageErrors, attachPageErrorCollectors } from './helpers/page-errors'

test.describe('page smoke', () => {
  test('public home /en renders a page landmark', async ({ page }) => {
    const errors = attachPageErrorCollectors(page)
    const res = await page.goto('/en', { waitUntil: 'domcontentloaded' })
    expect(res?.ok() ?? false).toBeTruthy()
    await expect(page.locator('article.cms-page h1').first()).toBeVisible()
    assertNoPageErrors(errors)
  })

  test('public login /en/login shows the sign-in form', async ({ page }) => {
    const errors = attachPageErrorCollectors(page)
    const res = await page.goto('/en/login', { waitUntil: 'domcontentloaded' })
    expect(res?.ok() ?? false).toBeTruthy()
    await expect(page.locator('.auth-page')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    assertNoPageErrors(errors)
  })

  test('unauthenticated /admin lands on login', async ({ page }) => {
    const errors = attachPageErrorCollectors(page)
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('input[name="email"]')).toBeVisible()
    assertNoPageErrors(errors)
  })

  test('authenticated /admin is Dashboard', async ({ page }) => {
    const errors = attachPageErrorCollectors(page)
    await signInAsSeedAdmin(page)
    const res = await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    expect(res?.ok() ?? false).toBeTruthy()
    await expect(page).toHaveURL(/\/admin\/?$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.locator('#users-admin-table')).toHaveCount(0)
    assertNoPageErrors(errors)
  })

  test('social feed /en/feed renders', async ({ page }) => {
    const errors = attachPageErrorCollectors(page)
    const res = await page.goto('/en/feed', { waitUntil: 'domcontentloaded' })
    expect(res?.ok() ?? false).toBeTruthy()
    await expect(page.locator('article.sf-social-feed-page')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Social' })).toBeVisible()
    assertNoPageErrors(errors)
  })
})

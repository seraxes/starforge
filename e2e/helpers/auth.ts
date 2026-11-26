import type { Page } from '@playwright/test'

const email = process.env.STARFORGE_SMOKE_ADMIN_EMAIL || 'admin@starforge.local'
const password = process.env.STARFORGE_SMOKE_ADMIN_PASSWORD || 'starforge-admin'

/**
 * Seed-admin Better Auth email sign-in. Cookies land on the browser context
 * (same jar as page navigations). Requires `npm run seed`.
 *
 * Origin must match Playwright baseURL and BETTER_AUTH_URL (localhost vs 127.0.0.1).
 */
export async function signInAsSeedAdmin(page: Page): Promise<void> {
  const base =
    process.env.PLAYWRIGHT_BASE_URL ||
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://127.0.0.1:3000'

  const res = await page.context().request.post('/api/auth/sign-in/email', {
    data: { email, password },
    headers: {
      'content-type': 'application/json',
      origin: base,
      referer: `${base}/login`,
    },
  })

  if (!res.ok()) {
    const body = await res.text()
    throw new Error(`seed admin sign-in failed: HTTP ${res.status()} ${body.slice(0, 200)}`)
  }
}

export { email as seedAdminEmail, password as seedAdminPassword }

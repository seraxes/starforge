import { config as loadEnv } from 'dotenv'
import { defineConfig, devices } from '@playwright/test'

loadEnv()

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://127.0.0.1:3000'

/**
 * Thin browser smoke for critical pages. Curl CI smoke stays the cheap boot gate;
 * this suite catches client errors and wrong screens.
 *
 * baseURL must match BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL (localhost vs 127.0.0.1)
 * or session cookies will not stick after sign-in.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /* Local convenience: reuse a running server; start next only when none is up. CI starts the app itself. */
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run start',
        url: `${baseURL}/api/health`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})

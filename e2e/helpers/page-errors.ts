import type { ConsoleMessage, Page } from '@playwright/test'

/** Benign third-party / browser noise that should not fail smoke. */
const CONSOLE_ERROR_ALLOWLIST: RegExp[] = [
  // Next.js / React DevTools hooks in some environments
  /Download the React DevTools/i,
]

export type PageErrorCollectors = {
  pageErrors: Error[]
  consoleErrors: string[]
}

export function attachPageErrorCollectors(page: Page): PageErrorCollectors {
  const pageErrors: Error[] = []
  const consoleErrors: string[] = []

  page.on('pageerror', (err) => {
    pageErrors.push(err)
  })

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (CONSOLE_ERROR_ALLOWLIST.some((re) => re.test(text))) return
    consoleErrors.push(text)
  })

  return { pageErrors, consoleErrors }
}

export function assertNoPageErrors(collectors: PageErrorCollectors): void {
  const pageMsgs = collectors.pageErrors.map((e) => e.message)
  if (pageMsgs.length || collectors.consoleErrors.length) {
    const parts = [
      pageMsgs.length ? `pageerror:\n- ${pageMsgs.join('\n- ')}` : '',
      collectors.consoleErrors.length
        ? `console error:\n- ${collectors.consoleErrors.join('\n- ')}`
        : '',
    ].filter(Boolean)
    throw new Error(`Page smoke found client errors:\n${parts.join('\n')}`)
  }
}

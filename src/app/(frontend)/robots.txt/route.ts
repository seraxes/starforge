import { appOrigin } from '@/core/content/metadata'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

export const dynamic = 'force-dynamic'

/**
 * Serve Site Chrome robots.txt at /robots.txt.
 * When product:redirects is on, inject `Sitemap:` with the env-correct origin
 * if the Chrome snippet does not already declare one.
 */
export async function GET() {
  const chrome = await getSiteChrome()
  let body = chrome.robotsTxt.trimEnd()

  try {
    const settings = await getSiteSettings()
    if (isCatalogModuleEnabled(settings, MODULE_IDS.redirects)) {
      const hasSitemapLine = /^sitemap:\s*\S+/im.test(body)
      if (!hasSitemapLine) {
        body = `${body}\n\nSitemap: ${appOrigin()}/sitemap.xml`
      }
    }
  } catch {
    // Keep Chrome snippet as-is if settings unavailable.
  }

  return new Response(`${body}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  })
}

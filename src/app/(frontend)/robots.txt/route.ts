import { appOrigin } from '@/core/content/metadata'
import { getSiteChrome } from '@/core/site-chrome'

export const dynamic = 'force-dynamic'

/**
 * Serve Site Chrome robots.txt at /robots.txt.
 * Appends an absolute Sitemap line when the snippet has none.
 */
export async function GET() {
  const chrome = await getSiteChrome()
  let body = chrome.robotsTxt.trimEnd()
  if (!/^\s*Sitemap\s*:/im.test(body)) {
    body = `${body}\n\nSitemap: ${appOrigin()}/sitemap.xml`
  }
  body = `${body}\n`
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  })
}

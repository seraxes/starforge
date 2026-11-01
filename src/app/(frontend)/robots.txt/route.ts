import { getSiteChrome } from '@/core/site-chrome'

export const dynamic = 'force-dynamic'

/** Serve Site Chrome robots.txt snippet at /robots.txt. */
export async function GET() {
  const chrome = await getSiteChrome()
  const body = chrome.robotsTxt.trimEnd() + '\n'
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  })
}

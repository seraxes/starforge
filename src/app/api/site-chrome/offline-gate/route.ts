import { NextResponse } from 'next/server'

import {
  getSiteChrome,
  isOfflineExemptPath,
} from '@/core/site-chrome'

export const dynamic = 'force-dynamic'

/**
 * Debug/compat offline gate (proxy reads Site Chrome in-process).
 * Same lock for everyone — no admin bypass. Does not gate /api, /admin, login.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const pathname = url.searchParams.get('path') || '/'

  if (isOfflineExemptPath(pathname)) {
    return NextResponse.json({ locked: false })
  }

  try {
    const chrome = await getSiteChrome()
    if (!chrome.offlineEnabled) {
      return NextResponse.json({ locked: false })
    }

    return NextResponse.json({
      locked: true,
      siteName: chrome.siteName,
      message: chrome.offlineMessage,
    })
  } catch {
    // Fail open if Chrome store is unavailable (boot / missing table).
    return NextResponse.json({ locked: false })
  }
}

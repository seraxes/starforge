import { NextResponse } from 'next/server'

import { userIsAppAdmin } from '@/core/auth/admin'
import { getAppSession } from '@/core/auth/session'
import {
  getSiteChrome,
  isOfflineExemptPath,
} from '@/core/site-chrome'

export const dynamic = 'force-dynamic'

/**
 * Lightweight gate for middleware: is this public HTML path locked offline?
 * Forwards cookies so app admins bypass. Does not gate /api, /admin, /app, login.
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

    const session = await getAppSession()
    if (userIsAppAdmin(session?.user)) {
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

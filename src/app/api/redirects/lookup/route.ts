import { NextResponse } from 'next/server'

import {
  findEnabledRedirectByFromPath,
  isRedirectExemptPath,
  normalizeFromPath,
} from '@/core/redirects'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

export const dynamic = 'force-dynamic'

/**
 * Lightweight lookup for middleware: from-path → { to, status } when
 * product:redirects is enabled. Fail open (no match) on errors.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const rawPath = url.searchParams.get('path') || '/'

  if (isRedirectExemptPath(rawPath)) {
    return NextResponse.json({ match: null })
  }

  const fromPath = normalizeFromPath(rawPath)
  if (!fromPath) {
    return NextResponse.json({ match: null })
  }

  try {
    const settings = await getSiteSettings()
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.redirects)) {
      return NextResponse.json({ match: null })
    }

    const match = await findEnabledRedirectByFromPath(fromPath)
    if (!match) {
      return NextResponse.json({ match: null })
    }

    return NextResponse.json({
      match: { to: match.to, status: match.status },
    })
  } catch {
    return NextResponse.json({ match: null })
  }
}

import { NextResponse } from 'next/server'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import {
  lookupEnabledRedirect,
  normalizeRedirectFromPath,
} from '@/core/redirects'

export const dynamic = 'force-dynamic'

/**
 * Lightweight lookup for middleware: enabled redirect for this pathname?
 * Fail-open (no hit) when module off, table missing, or errors.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const pathname = normalizeRedirectFromPath(url.searchParams.get('path') || '/')
  if (!pathname) {
    return NextResponse.json({ hit: false })
  }

  try {
    const settings = await getSiteSettings()
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.redirects)) {
      return NextResponse.json({ hit: false })
    }

    const hit = await lookupEnabledRedirect(pathname)
    if (!hit) {
      return NextResponse.json({ hit: false })
    }

    return NextResponse.json({
      hit: true,
      to: hit.to,
      status: hit.status,
    })
  } catch {
    return NextResponse.json({ hit: false })
  }
}

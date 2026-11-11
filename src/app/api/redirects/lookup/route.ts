import { NextResponse } from 'next/server'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import {
  lookupEnabledRedirect,
  normalizeRedirectFromPath,
} from '@/modules/redirects/api'

export const dynamic = 'force-dynamic'

/**
 * Debug/compat redirect lookup. The Node proxy uses generated `runProxyHooks`.
 * Fail-open (no hit) when the module is off, the table is missing, or the query errors.
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

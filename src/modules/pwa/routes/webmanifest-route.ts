import { NextResponse } from 'next/server'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { buildWebAppManifest } from '@/modules/pwa/build-webmanifest'

export const dynamic = 'force-dynamic'

/**
 * Dynamic Web App Manifest for product:pwa.
 * 404 when the module is off so installability stays gated by Modules.
 */
export async function GET() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.pwa)) {
    return new NextResponse(null, { status: 404 })
  }

  const manifest = await buildWebAppManifest()
  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  })
}

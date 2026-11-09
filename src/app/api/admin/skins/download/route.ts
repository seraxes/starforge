import { NextResponse } from 'next/server'

import { requireAdminArea } from '@/core/acl'
import {
  collectLiveOutlineSeedsForSkin,
} from '@/core/skin/actions'
import { getSkinPack } from '@/core/skin/registry'
import { skinPackZipFilename, zipSkinPack } from '@/core/skin/pack-zip'

export const dynamic = 'force-dynamic'

/**
 * Download a skin pack zip (YAML + CSS + live outline seeds).
 * Query: id (skin id)
 */
export async function GET(request: Request) {
  const session = await requireAdminArea('admin.layouts')
  if (!session?.user) {
    return NextResponse.json({ error: 'Layouts admin access required.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const skinId = (url.searchParams.get('id') || '').trim()
  if (!skinId) {
    return NextResponse.json({ error: 'id query parameter is required.' }, { status: 400 })
  }

  const pack = getSkinPack(skinId)
  if (!pack) {
    return NextResponse.json({ error: 'Skin not found.' }, { status: 404 })
  }

  try {
    const outlines = await collectLiveOutlineSeedsForSkin(skinId)
    const zip = zipSkinPack(pack, outlines)
    const filename = skinPackZipFilename(skinId)
    return new NextResponse(Buffer.from(zip), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not build skin pack.',
      },
      { status: 500 },
    )
  }
}

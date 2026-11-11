import { NextResponse } from 'next/server'

import { requireAdminArea } from '@/core/acl'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { buildEventRegistrantsCsv } from '@/modules/events/registrant-export'

export const dynamic = 'force-dynamic'

/**
 * Admin CSV export for one event’s registrants.
 * Query: eventId (required).
 */
export async function GET(request: Request) {
  const session = await requireAdminArea('admin.events')
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Events admin access required.' },
      { status: 401 },
    )
  }

  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    return NextResponse.json({ error: 'Events module is disabled.' }, { status: 403 })
  }

  const url = new URL(request.url)
  const eventId = (url.searchParams.get('eventId') || '').trim()
  const result = await buildEventRegistrantsCsv(eventId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return new NextResponse(result.csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

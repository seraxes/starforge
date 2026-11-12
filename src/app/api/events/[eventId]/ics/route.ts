import { NextResponse } from 'next/server'

import { getAccessViewer } from '@/core/acl/access'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import {
  viewerPassesEventPassword,
  viewerPassesEventVisibility,
} from '@/modules/events/public-access'
import { buildEventIcs } from '@/modules/events/public/ics'
import { findEventById, findPublishedEventByPublicKey, findVenueById } from '@/modules/events/store'

type Params = Promise<{ eventId: string }>

/**
 * GET /api/events/:eventId/ics — download calendar for a published event.
 * `eventId` may be id or public slug. Honors ACL + password unlock.
 */
export async function GET(_req: Request, { params }: { params: Params }) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    return new NextResponse('Events disabled', { status: 404 })
  }

  const { eventId } = await params
  const key = decodeURIComponent((eventId || '').trim())
  if (!key) return new NextResponse('Missing event', { status: 400 })

  const event =
    (await findPublishedEventByPublicKey(key)) ||
    (await findEventById(key).then((e) => (e?.status === 'published' ? e : null)))
  if (!event) return new NextResponse('Not found', { status: 404 })

  const viewer = await getAccessViewer()
  if (!(await viewerPassesEventVisibility(event, viewer))) {
    return new NextResponse('Not found', { status: 404 })
  }
  if (!(await viewerPassesEventPassword(event, viewer))) {
    return new NextResponse('Password required', { status: 401 })
  }

  const venue = event.venueId ? await findVenueById(event.venueId) : null
  const venueLine = venue
    ? [venue.name, venue.address].filter(Boolean).join(', ')
    : undefined

  const body = buildEventIcs(event, { venueLine })
  if (!body) {
    return new NextResponse('Event has no start time', { status: 422 })
  }

  const filename = `${(event.slug || event.id).replace(/[^a-z0-9-_]+/gi, '-')}.ics`
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=60',
    },
  })
}

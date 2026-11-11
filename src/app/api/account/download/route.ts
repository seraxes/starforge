import { NextResponse } from 'next/server'

import { buildAccountDataExport } from '@/core/auth/account-data'
import { getAppSession } from '@/core/auth/session'

export const dynamic = 'force-dynamic'

/**
 * GET /api/account/download — JSON export for the signed-in member only.
 */
export async function GET() {
  const session = await getAppSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to download your data.' }, { status: 401 })
  }

  const result = await buildAccountDataExport(session.user.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  const safeId = session.user.id.replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 24) || 'account'
  const filename = `starforge-account-${safeId}.json`

  return new NextResponse(JSON.stringify(result.payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'

import { db } from '@/core/db'

export const dynamic = 'force-dynamic'

/** Core health check — proves Starforge owns product APIs outside Payload. */
export async function GET() {
  try {
    await db.execute(sql`select 1`)
    return NextResponse.json({
      ok: true,
      service: 'starforge-core',
      database: 'up',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown database error'
    return NextResponse.json(
      {
        ok: false,
        service: 'starforge-core',
        database: 'down',
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }
}

import { NextResponse } from 'next/server'

import { resolveFeatureCspSources } from '@/core/security/feature-sources'

export const dynamic = 'force-dynamic'

/**
 * Feature-driven CSP sources for middleware (short-TTL cached there).
 * Public: returns only origins the public pages already reference.
 */
export async function GET() {
  try {
    return NextResponse.json({ sources: await resolveFeatureCspSources() })
  } catch {
    return NextResponse.json({ sources: {} })
  }
}

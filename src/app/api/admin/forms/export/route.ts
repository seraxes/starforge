import { NextResponse } from 'next/server'

import { requireAppAdmin } from '@/core/auth/admin'
import { buildFormSubmissionsCsv } from '@/modules/forms/csv'
import { loadFormDefinition } from '@/modules/forms/definitions-store'
import { listFormSubmissions } from '@/modules/forms/store'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

export const dynamic = 'force-dynamic'

/**
 * Admin CSV export for Form submissions.
 * Query: definitionId (required for scoped export), ids (optional comma list), limit (default 500).
 */
export async function GET(request: Request) {
  const admin = await requireAppAdmin()
  if (!admin?.user) {
    return NextResponse.json({ error: 'Admins only.' }, { status: 401 })
  }

  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    return NextResponse.json({ error: 'Forms module is disabled.' }, { status: 403 })
  }

  const url = new URL(request.url)
  const definitionId = (url.searchParams.get('definitionId') || '').trim()
  const idsRaw = (url.searchParams.get('ids') || '').trim()
  const selectedIds = idsRaw
    ? new Set(
        idsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
    : null
  const limitParam = Number(url.searchParams.get('limit') || '500')
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 2000) : 500

  if (!definitionId) {
    return NextResponse.json(
      { error: 'definitionId query parameter is required.' },
      { status: 400 },
    )
  }

  const loaded = await loadFormDefinition(definitionId)
  if (loaded.isFallback && loaded.source !== 'database' && definitionId !== 'contact') {
    return NextResponse.json({ error: 'Form definition not found.' }, { status: 404 })
  }

  let submissions = await listFormSubmissions({ definitionId, limit })
  if (selectedIds && selectedIds.size > 0) {
    submissions = submissions.filter((row) => selectedIds.has(row.id))
  }

  const csv = buildFormSubmissionsCsv({
    submissions,
    fields: loaded.document.fields,
  })

  const safeName = definitionId.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 64) || 'form'
  const filename = `form-${safeName}-submissions.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

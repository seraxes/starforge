import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireAdminArea } from '@/core/acl/access'
import { MODULE_IDS, getSiteSettingsLive, isCatalogModuleEnabled } from '@/core/settings'

import { listDocumentLinks } from '../api.server'
import { isDocumentSubjectKind } from '../links-rules'
import { listDocumentTemplates } from '../templates-store'
import { DocumentsTemplatesManager } from './templates-manager'

export const metadata = {
  title: 'Documents — Starforge',
  description: 'Document templates and subject file links.',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? '').trim()
  return (value ?? '').trim()
}

/** product:documents staff admin — templates + optional subject links. */
export default async function DocumentsAdminPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  // Live read — admin gate must not use a stale published settings cache after
  // Modules toggles (same posture as ensureSiteSettingsDefaults in admin layout).
  const settings = await getSiteSettingsLive()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.documents)) {
    redirect('/admin/settings')
  }

  // Staff: app admin or admin.documents edit (requireAdminArea / viewerMayAccessAdminResource).
  const session = await requireAdminArea('admin.documents', 'edit')
  if (!session) {
    redirect('/admin')
  }

  const params = searchParams ? await searchParams : {}
  const subjectKindRaw = firstParam(params.subjectKind)
  const subjectId = firstParam(params.subjectId)
  const subjectKind = isDocumentSubjectKind(subjectKindRaw) ? subjectKindRaw : null

  const templates = await listDocumentTemplates()

  let subjectLinks: Awaited<ReturnType<typeof listDocumentLinks>> | null = null
  if (subjectKind && subjectId) {
    subjectLinks = await listDocumentLinks({ subjectKind, subjectId })
  }

  return (
    <section className="admin-section admin-layouts-full">
      <h2>Documents</h2>
      <p className="lede admin-lede">
        Templates and the files linked to a person or a vehicle. Media keeps the bytes. Module
        on/off: <Link href="/admin/settings">Settings → Modules</Link>.
      </p>

      <DocumentsTemplatesManager
        templates={templates}
        initialSubjectKind={subjectKind ?? ''}
        subjectFiles={
          subjectKind && subjectId && subjectLinks
            ? {
                subjectKind,
                subjectId,
                links: subjectLinks.ok ? subjectLinks.value : [],
              }
            : null
        }
      />
    </section>
  )
}

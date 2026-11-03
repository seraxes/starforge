import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { listFormDefinitions } from '@/core/forms/definitions-store'
import { listFormSubmissions } from '@/core/forms'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { FormsAdminNav } from '../forms-admin-nav'
import { SubmissionsInbox } from './submissions-inbox'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Form submissions — Starforge',
  description: 'Inbox for public Form particle submissions.',
}

type PageProps = {
  searchParams?: Promise<{ definitionId?: string }>
}

export default async function AdminFormSubmissionsPage({ searchParams }: PageProps) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    redirect('/app/admin/settings')
  }

  const params = (await searchParams) ?? {}
  const filterDefinitionId = String(params.definitionId ?? '').trim()

  const [definitions, submissions] = await Promise.all([
    listFormDefinitions(),
    listFormSubmissions(
      filterDefinitionId
        ? { definitionId: filterDefinitionId, limit: 500 }
        : { limit: 100 },
    ),
  ])

  return (
    <section className="admin-section admin-layouts-full">
      <FormsAdminNav active="forms" />
      <h2>Submissions</h2>
      <p className="lede admin-lede">
        Deep-link inbox only (Submissions is not in Core/Payload nav or Forms tabs). Reach here from{' '}
        <Link href="/app/admin/forms/settings">Forms → Settings</Link> or a form’s Submissions /
        Export CSV actions under <Link href="/app/admin/forms">Forms</Link>. File fields store
        private Payload Media ids (open via <code>/api/admin/form-attachments/&lt;id&gt;</code>,
        admins only). CSV export scopes by definition
        {filterDefinitionId ? (
          <>
            {' '}
            — exporting{' '}
            <code>{filterDefinitionId}</code>
          </>
        ) : null}
        .
      </p>

      <SubmissionsInbox
        filterDefinitionId={filterDefinitionId}
        definitions={definitions.map((d) => ({
          id: d.id,
          label: d.label,
          preset: d.preset,
        }))}
        submissions={submissions.map((row) => ({
          id: row.id,
          formKey: row.formKey,
          definitionId: row.definitionId,
          payload: row.payload,
          ipAddress: row.ipAddress,
          createdAt: row.createdAt.toISOString(),
        }))}
      />
    </section>
  )
}

import React from 'react'
import { notFound, redirect } from 'next/navigation'

import {
  ensureDefaultContactFormSeeded,
  loadFormDefinition,
} from '@/core/forms'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { FormBuilder } from '../form-builder'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ formId: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { formId } = await params
  return {
    title: `Form ${formId} — Starforge`,
    description: 'Visual Form builder — fields, JSON Schema, presets.',
  }
}

export default async function AdminFormBuilderPage({ params }: PageProps) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    redirect('/app/admin/settings')
  }

  const { formId } = await params
  const id = (formId || '').trim()
  if (!id) notFound()

  await ensureDefaultContactFormSeeded()
  const loaded = await loadFormDefinition(id)

  // Unknown id with empty fallback (not contact) → 404
  if (loaded.isFallback && loaded.source !== 'database' && id !== 'contact') {
    notFound()
  }

  // Persist contact seed if first open
  if (loaded.isFallback && id === 'contact') {
    const { saveFormDefinitionDocument } = await import('@/core/forms/definitions-store')
    await saveFormDefinitionDocument(id, loaded.document, loaded.document.title)
  }

  return (
    <section className="admin-section admin-layouts-full">
      <h2>
        Form builder <span className="layout-muted">({loaded.label})</span>
      </h2>
      <FormBuilder
        key={loaded.id || id}
        formId={loaded.id || id}
        initialDocument={loaded.document}
      />
    </section>
  )
}

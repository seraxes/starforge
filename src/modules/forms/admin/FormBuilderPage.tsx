import React from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ensureDefaultUserGroupsSeeded, listUserGroupOptions } from '@/core/acl'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

import { isFormBuilderEmbedMode } from '../embed-mode'
import { ensureDefaultContactFormSeeded, loadFormDefinition } from '../index'
import { FormBuilder } from './form-builder'
import { FormsAdminNav } from './forms-admin-nav'

export const metadata = {
  title: 'Form builder — Starforge',
  description: 'Visual Form builder — fields, JSON Schema, presets.',
}

type PageProps = {
  params: Promise<{ formId: string }>
  searchParams?: Promise<{ embed?: string | string[] }>
}

/** product:forms visual builder. Protected ids are seeded by their owning packs, not here. */
export default async function FormBuilderPage({ params, searchParams }: PageProps) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    redirect('/admin/settings')
  }

  const { formId } = await params
  const id = (formId || '').trim()
  if (!id) notFound()

  const search = searchParams ? await searchParams : {}
  const embedRaw = Array.isArray(search.embed) ? search.embed[0] : search.embed
  const embed = isFormBuilderEmbedMode(embedRaw)

  await ensureDefaultContactFormSeeded()
  const loaded = await loadFormDefinition(id)

  // Unknown id with empty fallback (not the Forms-owned contact seed) → 404.
  // Protected profile / event / subscription ids are created by their owners.
  if (
    loaded.isFallback &&
    loaded.source !== 'database' &&
    id !== 'contact'
  ) {
    notFound()
  }

  // Persist the contact seed if this is the first open.
  if (loaded.isFallback && id === 'contact') {
    const { saveFormDefinitionDocument } = await import('../definitions-store')
    await saveFormDefinitionDocument(id, loaded.document, loaded.document.title)
  }

  const chrome = await getSiteChrome()
  await ensureDefaultUserGroupsSeeded()
  const groups = await listUserGroupOptions()
  const turnstileConfigured = Boolean(
    (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim() &&
      (process.env.TURNSTILE_SECRET_KEY ?? '').trim(),
  )

  return (
    <section className="admin-section layout-admin-section admin-layouts-full">
      {embed ? null : <FormsAdminNav active="forms" />}
      <h2 className="sr-only">
        Form builder ({loaded.label})
      </h2>
      {embed ? null : (
        <p className="lede admin-lede gantry-layouts-lede">
          <Link href="/admin/forms">← Forms</Link>
          {' · '}
          Editing <strong>{loaded.label}</strong> (<code>{loaded.id || id}</code>). Palette →
          section rows (side-by-side % columns) → field cog. Drag a field onto a row to join
          columns; + row / − row for empty drop rows; resize with the divider. Meta, success, and
          email live under Form settings.
        </p>
      )}
      <FormBuilder
        key={loaded.id || id}
        formId={loaded.id || id}
        initialDocument={loaded.document}
        groups={groups}
        siteCaptcha={{
          enabled: chrome.captchaEnabled,
          provider: chrome.captchaProvider,
          configured: turnstileConfigured,
        }}
      />
    </section>
  )
}

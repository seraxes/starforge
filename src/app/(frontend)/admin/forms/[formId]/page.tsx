import React from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ensureDefaultUserGroupsSeeded, listUserGroupOptions } from '@/core/acl'
import {
  ensureDefaultContactFormSeeded,
  loadFormDefinition,
} from '@/core/forms'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

import { FormBuilder } from '../form-builder'
import { FormsAdminNav } from '../forms-admin-nav'

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
    redirect('/admin/settings')
  }

  const { formId } = await params
  const id = (formId || '').trim()
  if (!id) notFound()

  await ensureDefaultContactFormSeeded()
  if (id === 'profile') {
    const { ensureProfileFormSeeded } = await import('@/modules/profiles/profile-form')
    await ensureProfileFormSeeded()
  }
  const loaded = await loadFormDefinition(id)

  // Unknown id with empty fallback (not contact/profile) → 404
  if (
    loaded.isFallback &&
    loaded.source !== 'database' &&
    id !== 'contact' &&
    id !== 'profile'
  ) {
    notFound()
  }

  // Persist seed if first open
  if (loaded.isFallback && (id === 'contact' || id === 'profile')) {
    const { saveFormDefinitionDocument } = await import('@/core/forms/definitions-store')
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
      <FormsAdminNav active="forms" />
      <h2 className="sr-only">
        Form builder ({loaded.label})
      </h2>
      <p className="lede admin-lede gantry-layouts-lede">
        <Link href="/admin/forms">← Forms</Link>
        {' · '}
        Editing <strong>{loaded.label}</strong> (<code>{loaded.id || id}</code>). Palette →
        section rows (side-by-side % columns) → field cog. Drag a field onto a row to join
        columns; + row / − row for empty drop rows; resize with the divider. Meta, success, and
        email live under Form settings.
      </p>
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

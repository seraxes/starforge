import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ensureDefaultContactFormSeeded, listFormDefinitions } from '@/core/forms'
import { isFormPresetCategoryId } from '@/core/forms/presets'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { ensureEventRegistrationFormSeeded } from '@/modules/events/registration-form'
import { ensureProfileFormSeeded } from '@/modules/profiles/profile-form'

import { FormsAdminNav } from './forms-admin-nav'
import { FormsManager } from './forms-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Forms — Starforge',
  description: 'Modular Form engine — definitions and visual builder.',
}

type Search = Promise<{ category?: string }>

export default async function AdminFormsPage({ searchParams }: { searchParams: Search }) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    redirect('/admin/settings')
  }

  const params = await searchParams
  const rawCategory = (params.category ?? 'all').trim() || 'all'
  const categoryFilter =
    rawCategory === 'all' || isFormPresetCategoryId(rawCategory) ? rawCategory : 'all'

  await ensureDefaultContactFormSeeded()
  if (isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    await ensureEventRegistrationFormSeeded()
  }
  if (isCatalogModuleEnabled(settings, MODULE_IDS.profiles)) {
    await ensureProfileFormSeeded()
  }
  const definitions = await listFormDefinitions()

  return (
    <section className="admin-section admin-layouts-full">
      <FormsAdminNav active="forms" />
      <h2 className="sr-only">Forms</h2>
      <p className="lede admin-lede gantry-layouts-lede">
        Modular Form engine: Layout-aligned visual builder → JSON Schema / Zod. Place the{' '}
        <strong>Form</strong> particle under <Link href="/admin/layouts">Layouts</Link>. Captcha
        under <Link href="/admin/settings/security">Settings → Security</Link>. Module on/off
        under <Link href="/admin/settings">Settings</Link>.
      </p>

      <FormsManager
        categoryFilter={categoryFilter}
        forms={definitions.map((d) => ({
          id: d.id,
          label: d.label,
          preset: d.preset,
          fieldCount: d.fieldCount,
          updatedAt: d.updatedAt.toISOString(),
        }))}
      />
    </section>
  )
}

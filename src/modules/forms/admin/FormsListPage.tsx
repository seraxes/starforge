import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { ensureDefaultContactFormSeeded, listFormDefinitions } from '../index'
import { isFormPresetCategoryId } from '../presets'
import { FormsAdminNav } from './forms-admin-nav'
import { FormsManager } from './forms-manager'

export const metadata = {
  title: 'Forms — Starforge',
  description: 'Modular Form engine — definitions and visual builder.',
}

type Search = Promise<{ category?: string }>

/** product:forms list. Lists and links only — protected definitions are seeded by their owners. */
export default async function FormsListPage({ searchParams }: { searchParams: Search }) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    redirect('/admin/settings')
  }

  const params = await searchParams
  const rawCategory = (params.category ?? 'all').trim() || 'all'
  const categoryFilter =
    rawCategory === 'all' || isFormPresetCategoryId(rawCategory) ? rawCategory : 'all'

  await ensureDefaultContactFormSeeded()
  const definitions = await listFormDefinitions()

  return (
    <section className="admin-section layout-admin-section admin-layouts-full">
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

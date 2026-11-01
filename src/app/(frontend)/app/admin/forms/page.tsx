import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ensureDefaultContactFormSeeded, listFormDefinitions } from '@/core/forms'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { FormsAdminNav } from './forms-admin-nav'
import { FormsManager } from './forms-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Forms — Starforge',
  description: 'Modular Form engine — definitions and visual builder.',
}

export default async function AdminFormsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    redirect('/app/admin/settings')
  }

  await ensureDefaultContactFormSeeded()
  const definitions = await listFormDefinitions()

  return (
    <section className="admin-section admin-layouts-full">
      <FormsAdminNav active="forms" />
      <h2>Forms</h2>
      <p className="lede admin-lede">
        Modular Form engine: Layout-aligned visual builder → JSON Schema / Zod. Place the{' '}
        <strong>Form</strong> particle under <Link href="/app/admin/layouts">Layouts</Link>. Captcha
        in <Link href="/app/admin/site-chrome">Site Chrome</Link>. Module on/off under{' '}
        <Link href="/app/admin/settings">Site Settings</Link>.
      </p>

      <FormsManager
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

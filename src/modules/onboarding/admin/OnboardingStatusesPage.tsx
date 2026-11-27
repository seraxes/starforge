import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { ensureSeededStatuses, listStatuses } from '../store'
import { StatusesManager } from './statuses-manager'

export const metadata = {
  title: 'Statuses — Onboarding — Starforge',
  description: 'Onboarding status builder (Onboarding module).',
}

/** product:onboarding — admin status list and edit. */
export default async function OnboardingStatusesPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.onboarding)) {
    redirect('/admin/settings')
  }

  const statuses = await ensureSeededStatuses().catch(async () => listStatuses())

  let formOptions: Array<{ id: string; label: string }> = []
  try {
    const { listFormDefinitions } = await import('@/modules/forms/api')
    const definitions = await listFormDefinitions()
    formOptions = definitions.map((form) => ({
      id: form.id,
      label: form.label?.trim() || form.id,
    }))
  } catch {
    /* Forms optional at render if migrate pending */
  }

  const rows = statuses.map((status) => ({
    id: status.id,
    key: status.key,
    name: status.name,
    bookable: status.bookable,
    formDefinitionId: status.formDefinitionId,
    sortOrder: status.sortOrder,
    updatedAt: status.updatedAt.toISOString(),
  }))

  return (
    <section className="admin-section admin-layouts-full">
      <h2>Statuses</h2>
      <p className="lede admin-lede">
        <strong>Add +</strong> · list · Edit one status. Each status may attach one{' '}
        <Link href="/admin/forms">Forms</Link> definition. Bookable means Fleet may book the
        person without vehicle access. Seeded: recruiting, active (bookable), inactive, closed
        (visszautasítva), banned (kitiltva).
      </p>
      <StatusesManager statuses={rows} formOptions={formOptions} />
    </section>
  )
}

import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { ensureSeededStatuses, listStatuses } from '../store'
import { OnboardingAdminNav } from './onboarding-admin-nav'
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

  let templateOptions: Array<{ id: string; label: string }> = []
  try {
    const { listEmailTemplates } = await import('@/modules/email-manager/api.server')
    const templates = await listEmailTemplates()
    templateOptions = templates.map((tpl) => ({
      id: tpl.id,
      label: tpl.label?.trim() || tpl.id,
    }))
  } catch {
    /* Email Manager optional at render if migrate pending */
  }

  const rows = statuses.map((status) => ({
    id: status.id,
    key: status.key,
    name: status.name,
    phase: status.phase,
    displayLabel: status.displayLabel,
    actionChip: status.actionChip,
    nextStepMessage: status.nextStepMessage,
    bookable: status.bookable,
    formDefinitionId: status.formDefinitionId,
    reminderTemplateId: status.reminderTemplateId,
    sortOrder: status.sortOrder,
    updatedAt: status.updatedAt.toISOString(),
  }))

  return (
    <section className="admin-section admin-layouts-full">
      <OnboardingAdminNav active="statuses" />
      <h2>Statuses</h2>
      <p className="lede admin-lede">
        <Link href="/admin/onboarding">← People</Link>
        {' · '}
        <strong>Add +</strong> · drag ▣ to reorder · Edit one status. Phase is recruiting, declined,
        inactive, active, or banned — active is bookable. Display label is what the people table
        shows. Recruiting rows may bind a reminder{' '}
        <Link href="/admin/email/templates">Email Manager</Link> template. Invite and event-type
        templates: <Link href="/admin/onboarding/settings">Settings</Link>.
      </p>
      <StatusesManager
        statuses={rows}
        formOptions={formOptions}
        templateOptions={templateOptions}
      />
    </section>
  )
}

import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listDashboardTiles } from '../dashboard-tile-store'
import { listDepots } from '../depot-store'
import { ensureSeededEventTypes, listEventTypes } from '../event-type-store'
import { loadOnboardingModuleSettings } from '../settings'
import { ensureSeededStatuses, listStatuses } from '../store'
import { statusListLabel } from '../status-rules'
import { ensureSeededTags, listTags } from '../tag-store'
import { OnboardingAdminNav } from './onboarding-admin-nav'
import { OnboardingSettingsForm } from './onboarding-settings-form'

export const metadata = {
  title: 'Settings — Onboarding — Starforge',
  description:
    'Onboarding invite email, event-type catalog, depots, staff tags, and dashboard tiles (Onboarding module).',
}

/** product:onboarding — invite template + event-type catalog + depot + tags + dashboard tiles. */
export default async function OnboardingSettingsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.onboarding)) {
    redirect('/admin/settings')
  }

  const loaded = await loadOnboardingModuleSettings()
  const statuses = await ensureSeededStatuses().catch(async () => listStatuses())
  const depots = await listDepots().catch(() => [])
  const tags = await ensureSeededTags().catch(() => listTags())
  const tiles = await listDashboardTiles().catch(() => [])
  const eventTypes = await ensureSeededEventTypes().catch(() => listEventTypes().catch(() => []))

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

  const statusOptions = statuses.map((status) => ({
    id: status.id,
    label: statusListLabel(status) || status.name || status.key || status.id,
  }))

  return (
    <section className="admin-section admin-layouts-full">
      <OnboardingAdminNav active="settings" />
      <h2>Onboarding settings</h2>
      <p className="lede admin-lede">
        Bind the new-driver invite template. Event types are a catalog: add, deactivate, or
        delete. Each type keeps its confirmation template, Forms definition, date fields, and
        active / completed statuses. Depots are the catalog while Fleet is off. Staff tags mark a
        person and do not move status. Dashboard tiles feed the driver-home particle. Subject and
        body stay in <Link href="/admin/email/templates">Email Manager</Link>. Recruiting status
        reminders: <Link href="/admin/onboarding/statuses">Statuses</Link>. Module on/off:{' '}
        <Link href="/admin/settings">Settings → Modules</Link>.
      </p>
      {loaded.isFallback ? (
        <p className="layout-muted">
          Using code defaults (source: {loaded.source}). Run{' '}
          <code>npm run db:migrate</code> if <code>sf_module_settings</code> is missing.
        </p>
      ) : null}
      <OnboardingSettingsForm
        settings={loaded.settings}
        templateOptions={templateOptions}
        formOptions={formOptions}
        statusOptions={statusOptions}
        depots={depots.map((depot) => ({
          id: depot.id,
          name: depot.name,
          address: depot.address,
          sortOrder: depot.sortOrder,
        }))}
        tags={tags.map((tag) => ({
          id: tag.id,
          label: tag.label,
          color: tag.color,
          todo: tag.todo,
          fade: tag.fade,
          sortOrder: tag.sortOrder,
        }))}
        tiles={tiles.map((tile) => ({
          id: tile.id,
          title: tile.title,
          icon: tile.icon,
          url: tile.url,
          sortOrder: tile.sortOrder,
          published: tile.published,
          statusIds: tile.statusIds,
          staffOnly: tile.staffOnly,
        }))}
        eventTypes={eventTypes.map((row) => ({
          id: row.id,
          key: row.key,
          label: row.label,
          enabled: row.enabled,
          templateId: row.templateId,
          formDefinitionId: row.formDefinitionId,
          dateFieldNames: row.dateFieldNames,
          activeStatusIds: row.activeStatusIds,
          completedStatusIds: row.completedStatusIds,
          sortOrder: row.sortOrder,
        }))}
      />
    </section>
  )
}

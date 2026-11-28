import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { ensureOnboardingEmailStartersSeeded } from '../email-starters'
import { listWorkers } from '../procedure-store'
import { ensureSeededStatuses, listStatuses } from '../store'
import { OnboardingAdminNav } from './onboarding-admin-nav'
import { WorkersManager } from './workers-manager'

export const metadata = {
  title: 'People — Onboarding — Starforge',
  description: 'Onboarding workers table and invite (Onboarding module).',
}

/** product:onboarding — workers list + invite. */
export default async function OnboardingWorkersPage({
  searchParams,
}: {
  searchParams?: Promise<{ statusId?: string }>
}) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.onboarding)) {
    redirect('/admin/settings')
  }

  const params = (await searchParams) ?? {}
  const statusId = (params.statusId ?? '').trim()

  const statuses = await ensureSeededStatuses().catch(async () => listStatuses())
  await ensureOnboardingEmailStartersSeeded().catch(() => null)
  const workers = await listWorkers(statusId ? { statusId } : undefined)

  return (
    <section className="admin-section admin-layouts-full">
      <OnboardingAdminNav active="people" />
      <h2>People</h2>
      <p className="lede admin-lede">
        Invite creates a Core user, places them in recruiting, and sends set-password plus
        application mail through Email Manager. Event outcomes stay on the card — they do not
        move the main status. Training reports:{' '}
        <Link href="/admin/onboarding/training">Training</Link>.
      </p>
      <WorkersManager
        workers={workers.map((row) => ({
          userId: row.userId,
          name: row.name,
          email: row.email,
          statusId: row.statusId,
          statusKey: row.statusKey,
          statusName: row.statusName,
          phone: row.phone,
          driverCode: row.driverCode,
          eventCount: row.eventCount,
          noteCount: row.noteCount,
        }))}
        statuses={statuses.map((s) => ({
          id: s.id,
          key: s.key,
          name: s.displayLabel || s.name,
        }))}
        statusFilter={statusId}
      />
    </section>
  )
}

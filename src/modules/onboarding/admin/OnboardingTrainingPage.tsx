import React from 'react'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listWorkers } from '../procedure-store'
import {
  listQualifications,
  listTrainerSlots,
  listTrainers,
  listTrainingReports,
} from '../training-store'
import { OnboardingAdminNav } from './onboarding-admin-nav'
import { TrainingManager } from './training-manager'

export const metadata = {
  title: 'Training — Onboarding — Starforge',
  description: 'Training reports, trainer calendar, and qualifications (Onboarding module).',
}

/** product:onboarding — training reports, trainer calendar, qualifications. */
export default async function OnboardingTrainingPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.onboarding)) {
    redirect('/admin/settings')
  }

  const [reports, slots, trainers, qualifications, workers] = await Promise.all([
    listTrainingReports(),
    listTrainerSlots(),
    listTrainers(),
    listQualifications(),
    listWorkers(),
  ])

  const people = workers.map((w) => ({
    userId: w.userId,
    label: w.name || w.email || w.userId,
    statusId: w.statusId,
    statusName: w.statusName || w.statusKey || '',
  }))

  return (
    <section className="admin-section admin-layouts-full">
      <OnboardingAdminNav active="training" />
      <h2>Training</h2>
      <p className="lede admin-lede">
        Practical checklist reports (14 sections), trainer calendar (max 3 slots per day), and
        dated qualifications. A checklist or quiz pass records a qualification date and does not
        move the person&apos;s status. Quiz questions stay in Forms — this pack stores the attempt
        result only. PDF bytes go to Media until Documents exists.
      </p>
      <TrainingManager
        people={people}
        reports={reports.map((r) => ({
          id: r.id,
          traineeUserId: r.traineeUserId,
          instructorUserId: r.instructorUserId,
          reportDate: r.reportDate,
          depotKey: r.depotKey,
          depotLabel: r.depotLabel,
          trainingDay: r.trainingDay,
          plate: r.plate,
          rounds: r.rounds,
          drove: r.drove,
          status: r.status,
          passed: r.passed,
          note: r.note,
          checklist: r.checklist,
          mediaId: r.mediaId,
        }))}
        slots={slots.map((s) => ({
          id: s.id,
          instructorUserId: s.instructorUserId,
          slotDate: s.slotDate,
          slotIndex: s.slotIndex,
          startTime: s.startTime,
          locationCode: s.locationCode,
          traineeUserId: s.traineeUserId,
          kind: s.kind,
          status: s.status,
        }))}
        trainers={trainers.map((t) => ({
          id: t.id,
          name: t.name,
          phone: t.phone,
          linkedUserId: t.linkedUserId,
        }))}
        qualifications={qualifications.map((q) => ({
          id: q.id,
          userId: q.userId,
          source: q.source,
          qualifiedDate: q.qualifiedDate,
          createdAt: q.createdAt.toISOString(),
        }))}
      />
    </section>
  )
}

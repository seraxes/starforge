import React from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { ensureSeededEventTypes, listEventTypes } from '../event-type-store'
import { getPersonCard } from '../procedure-store'
import { ensureSeededStatuses, listStatuses } from '../store'
import { statusListLabel } from '../status-rules'
import { ensureSeededTags, listTags } from '../tag-store'
import { PersonManager } from './person-manager'

export const metadata = {
  title: 'Person — Onboarding — Starforge',
  description:
    'Onboarding person card: valid-until dates, events, notes, follow-up, calls, mail log.',
}

type Params = Promise<{ userId: string }>

/** product:onboarding — person card with procedure stack. */
export default async function OnboardingPersonPage({ params }: { params: Params }) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.onboarding)) {
    redirect('/admin/settings')
  }

  const { userId: raw } = await params
  const userId = decodeURIComponent(raw || '').trim()
  if (!userId) notFound()

  const card = await getPersonCard(userId)
  if (!card.worker) notFound()

  const statuses = await ensureSeededStatuses().catch(async () => listStatuses())
  const statusOptions = statuses.map((status) => ({
    id: status.id,
    label: statusListLabel(status) || status.name || status.key || status.id,
  }))
  const tags = await ensureSeededTags().catch(() => listTags())
  const tagOptions = tags.map((tag) => ({
    id: tag.id,
    label: tag.label,
    color: tag.color,
    todo: tag.todo,
    fade: tag.fade,
  }))

  const eventTypes = await ensureSeededEventTypes().catch(() => listEventTypes().catch(() => []))
  const kindOptions = eventTypes.map((row) => ({
    key: row.key,
    label: row.label,
    enabled: row.enabled,
  }))

  const documentsEnabled = isCatalogModuleEnabled(settings, MODULE_IDS.documents)
  const documentsHref = `/admin/documents?subjectKind=onboarding&subjectId=${encodeURIComponent(userId)}`

  return (
    <section className="admin-section admin-layouts-full">
      <h2>{card.worker.name || card.worker.email}</h2>
      <p className="lede admin-lede">
        <Link href="/admin/onboarding">← People</Link>
        {' · '}
        Status: <strong>{card.worker.statusName || card.worker.statusKey || '—'}</strong>
        {card.worker.phone ? ` · ${card.worker.phone}` : ''}
        {card.worker.driverCode ? ` · code ${card.worker.driverCode}` : ''}
        {' · '}
        {card.worker.email}
        {documentsEnabled ? (
          <>
            {' · '}
            <Link href={documentsHref}>Documents</Link>
          </>
        ) : null}
      </p>
      <PersonManager
        userId={userId}
        statusId={card.worker.statusId}
        statusOptions={statusOptions}
        tagOptions={tagOptions}
        events={card.events.map((e) => ({
          id: e.id,
          kind: e.kind,
          location: e.location,
          address: e.address,
          eventDate: e.eventDate,
          eventTime: e.eventTime,
          courierName: e.courierName,
          courierPhone: e.courierPhone,
          meetingMode: e.meetingMode,
          examUrl: e.examUrl,
          applicantResponse: e.applicantResponse,
          outcome: e.outcome,
          alsoTrial: e.alsoTrial,
          requestedDates: e.requestedDates,
          requestedSubmissionId: e.requestedSubmissionId,
          dueNotice: e.dueNotice,
        }))}
        notes={card.notes.map((n) => ({
          id: n.id,
          body: n.body,
          authorUserId: n.authorUserId,
          createdAt: n.createdAt.toISOString(),
        }))}
        followUps={card.followUps.map((f) => ({
          id: f.id,
          tags: f.tags,
          note: f.note,
          reminderStatus: f.reminderStatus,
        }))}
        calls={card.calls.map((c) => ({
          id: c.id,
          callAt: c.callAt?.toISOString() ?? '',
          done: c.done,
          dueNotice: c.dueNotice,
        }))}
        mailLogs={card.mailLogs.map((m) => ({
          id: m.id,
          channel: m.channel,
          subject: m.subject,
          toEmail: m.toEmail,
          sentAt: m.sentAt.toISOString(),
        }))}
        kindOptions={kindOptions}
        documentSlots={card.documentSlots.map((s) => ({
          kind: s.kind,
          mediaId: s.mediaId,
          validUntil: s.validUntil,
        }))}
      />
    </section>
  )
}

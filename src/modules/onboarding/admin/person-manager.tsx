'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  createOnboardingCallAction,
  createOnboardingEventAction,
  createOnboardingNoteAction,
  saveOnboardingFollowUpAction,
  saveOnboardingValidUntilAction,
  setOnboardingEventOutcomeAction,
  updateOnboardingCallAction,
  updateOnboardingEventAction,
  updateOnboardingPersonStatusAction,
  type OnboardingAdminActionState,
} from '../actions'
import { ONBOARDING_EVENT_KINDS, type OnboardingEventKind } from '../procedure-rules'
import {
  ONBOARDING_DOCUMENT_KIND_LABELS,
  ONBOARDING_DOCUMENT_KINDS,
  validUntilState,
  type OnboardingDocumentKind,
} from '../valid-until-rules'

const initial: OnboardingAdminActionState = {}

type EventRow = {
  id: string
  kind: OnboardingEventKind
  location: string
  address: string
  eventDate: string
  eventTime: string
  courierName: string
  courierPhone: string
  meetingMode: string
  examUrl: string
  applicantResponse: string
  outcome: string
  alsoTrial: boolean
  requestedDates: string[]
  requestedSubmissionId: string
  dueNotice: boolean
}

type NoteRow = { id: string; body: string; authorUserId: string; createdAt: string }
type FollowUpRow = { id: string; tags: string[]; note: string; reminderStatus: string }
type CallRow = { id: string; callAt: string; done: boolean; dueNotice: boolean }
type MailRow = {
  id: string
  channel: string
  subject: string
  toEmail: string
  sentAt: string
}

type DocumentSlotRow = {
  kind: OnboardingDocumentKind
  mediaId: string
  validUntil: string
}

type StatusOption = { id: string; label: string }
type TagOption = {
  id: string
  label: string
  color: string
  todo: boolean
  fade: boolean
}

type Props = {
  userId: string
  statusId: string
  statusOptions: StatusOption[]
  tagOptions: TagOption[]
  events: EventRow[]
  notes: NoteRow[]
  followUps: FollowUpRow[]
  calls: CallRow[]
  mailLogs: MailRow[]
  documentSlots: DocumentSlotRow[]
  outcomeOptions: Record<OnboardingEventKind, string[]>
}

function Feedback({ state }: { state: OnboardingAdminActionState }) {
  if (state.error) {
    return (
      <p className="admin-inline-error" role="alert">
        {state.error}
      </p>
    )
  }
  if (state.ok && state.message) {
    return (
      <p className="admin-inline-ok" role="status">
        {state.message}
      </p>
    )
  }
  return null
}

function EventCard({
  userId,
  event,
  outcomes,
}: {
  userId: string
  event?: EventRow
  outcomes: string[]
}) {
  const router = useRouter()
  const isNew = !event
  const saveAction = isNew ? createOnboardingEventAction : updateOnboardingEventAction
  const [state, action, pending] = useActionState(saveAction, initial)
  const [outcomeState, outcomeAction, outcomePending] = useActionState(
    setOnboardingEventOutcomeAction,
    initial,
  )
  const [kind, setKind] = useState(event?.kind ?? 'ridealong')
  const [meetingMode, setMeetingMode] = useState(event?.meetingMode ?? 'onsite')
  const [applicantResponse, setApplicantResponse] = useState(event?.applicantResponse ?? '')
  const [alsoTrial, setAlsoTrial] = useState(event?.alsoTrial === true)
  const [dueNotice, setDueNotice] = useState(event?.dueNotice === true)
  const [outcome, setOutcome] = useState(event?.outcome ?? '')

  useNotifySavedOnOk(state)
  useNotifySavedOnOk(outcomeState)
  useEffect(() => {
    if (state.ok || outcomeState.ok) router.refresh()
  }, [state.ok, outcomeState.ok, router])

  useEffect(() => {
    setKind(event?.kind ?? 'ridealong')
    setMeetingMode(event?.meetingMode ?? 'onsite')
    setApplicantResponse(event?.applicantResponse ?? '')
    setAlsoTrial(event?.alsoTrial === true)
    setDueNotice(event?.dueNotice === true)
    setOutcome(event?.outcome ?? '')
  }, [event])

  const formId = event ? `sf-onboarding-event-${event.id}` : 'sf-onboarding-event-new'
  const busy = pending || outcomePending
  const kindOutcomes = outcomes.length
    ? outcomes
    : (['email_sent'] as string[])

  return (
    <div className="page-settings-panel">
      <div className="page-settings-panel-head">
        <h3>{isNew ? 'New event' : `${event.kind} card`}</h3>
      </div>
      <div className="page-settings-panel-body">
        <form id={formId} action={action} className="sf-events-form-mosaic-form">
          <input type="hidden" name="userId" value={userId} />
          {event ? <input type="hidden" name="eventId" value={event.id} /> : null}
          <label className="settings-field">
            <span>Kind</span>
            <select
              name="kind"
              value={kind}
              disabled={busy}
              onChange={(e) => setKind(e.target.value as OnboardingEventKind)}
            >
              {ONBOARDING_EVENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>Location</span>
            <input
              type="text"
              name="location"
              defaultValue={event?.location ?? ''}
              disabled={busy}
            />
          </label>
          <label className="settings-field">
            <span>Address</span>
            <input
              type="text"
              name="address"
              defaultValue={event?.address ?? ''}
              disabled={busy}
            />
          </label>
          <label className="settings-field">
            <span>Date</span>
            <input
              type="date"
              name="eventDate"
              defaultValue={event?.eventDate ?? ''}
              disabled={busy}
            />
          </label>
          <label className="settings-field">
            <span>Time</span>
            <input
              type="time"
              name="eventTime"
              defaultValue={event?.eventTime ?? ''}
              disabled={busy}
            />
          </label>
          <label className="settings-field">
            <span>Courier name</span>
            <input
              type="text"
              name="courierName"
              defaultValue={event?.courierName ?? ''}
              disabled={busy}
            />
          </label>
          <label className="settings-field">
            <span>Courier phone</span>
            <input
              type="text"
              name="courierPhone"
              defaultValue={event?.courierPhone ?? ''}
              disabled={busy}
            />
          </label>
          <label className="settings-field">
            <span>Meeting mode</span>
            <select
              name="meetingMode"
              value={meetingMode}
              disabled={busy}
              onChange={(e) => setMeetingMode(e.target.value)}
            >
              <option value="onsite">Onsite</option>
              <option value="online">Online</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Exam URL</span>
            <input
              type="url"
              name="examUrl"
              defaultValue={event?.examUrl ?? ''}
              disabled={busy}
            />
          </label>
          <label className="settings-field">
            <span>Applicant response</span>
            <select
              name="applicantResponse"
              value={applicantResponse}
              disabled={busy}
              onChange={(e) => setApplicantResponse(e.target.value)}
            >
              <option value="">—</option>
              <option value="attending">Attending</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Requested dates</span>
            <textarea
              name="requestedDates"
              defaultValue={(event?.requestedDates ?? []).join('\n')}
              disabled={busy}
              rows={2}
            />
          </label>
          <label className="settings-field">
            <span>Requested submission id</span>
            <input
              type="text"
              name="requestedSubmissionId"
              defaultValue={event?.requestedSubmissionId ?? ''}
              disabled={busy}
            />
          </label>
          <label className="settings-field settings-flag">
            <span>Also trial</span>
            <input
              type="checkbox"
              name="alsoTrial"
              value="1"
              checked={alsoTrial}
              disabled={busy}
              onChange={(e) => setAlsoTrial(e.target.checked)}
            />
          </label>
          <label className="settings-field settings-flag">
            <span>Due notice</span>
            <input
              type="checkbox"
              name="dueNotice"
              value="1"
              checked={dueNotice}
              disabled={busy}
              onChange={(e) => setDueNotice(e.target.checked)}
            />
          </label>
        </form>
        <Feedback state={state} />
        <div className="page-settings-actions admin-action-row">
          <button
            type="submit"
            form={formId}
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={busy}
          >
            {pending ? 'Saving…' : isNew ? 'Create event' : 'Save event'}
          </button>
        </div>

        {event ? (
          <form action={outcomeAction} className="admin-control-row" style={{ marginTop: '0.75rem' }}>
            <input type="hidden" name="eventId" value={event.id} />
            <label className="settings-field" style={{ margin: 0 }}>
              <span className="sr-only">Outcome</span>
              <select
                name="outcome"
                value={outcome}
                disabled={busy}
                onChange={(e) => setOutcome(e.target.value)}
              >
                <option value="">Outcome…</option>
                {kindOutcomes.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              disabled={busy || !outcome}
            >
              {outcomePending ? 'Setting…' : 'Set outcome'}
            </button>
            <Feedback state={outcomeState} />
          </form>
        ) : null}
      </div>
    </div>
  )
}

function slotValue(
  slots: DocumentSlotRow[],
  kind: OnboardingDocumentKind,
): { mediaId: string; validUntil: string } {
  const row = slots.find((s) => s.kind === kind)
  return { mediaId: row?.mediaId ?? '', validUntil: row?.validUntil ?? '' }
}

function ValidUntilPanel({
  userId,
  documentSlots,
}: {
  userId: string
  documentSlots: DocumentSlotProp[]
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(saveOnboardingValidUntilAction, initial)
  const licence = slotValue(documentSlots, 'driving_licence')
  const health = slotValue(documentSlots, 'health_booklet')
  const contract = slotValue(documentSlots, 'contract')
  const [drivingLicenceValidUntil, setDrivingLicenceValidUntil] = useState(licence.validUntil)
  const [healthBookletValidUntil, setHealthBookletValidUntil] = useState(health.validUntil)
  const [contractValidUntil, setContractValidUntil] = useState(contract.validUntil)

  useNotifySavedOnOk(state)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  useEffect(() => {
    setDrivingLicenceValidUntil(slotValue(documentSlots, 'driving_licence').validUntil)
    setHealthBookletValidUntil(slotValue(documentSlots, 'health_booklet').validUntil)
    setContractValidUntil(slotValue(documentSlots, 'contract').validUntil)
  }, [documentSlots])

  const formKey = [
    licence.validUntil,
    health.validUntil,
    contract.validUntil,
    licence.mediaId,
    health.mediaId,
    contract.mediaId,
  ].join('|')

  const hintFor = (value: string) => {
    const stateLabel = validUntilState(value)
    if (stateLabel === 'missing') return 'Missing (not expired)'
    if (stateLabel === 'expired') return 'Expired'
    return 'Valid'
  }

  return (
    <div className="page-settings-panel" style={{ gridColumn: '1 / -1' }}>
      <div className="page-settings-panel-head">
        <h3>Valid-until</h3>
      </div>
      <div className="page-settings-panel-body">
        <p className="settings-hint">
          Dates on the person for driving licence, health booklet, and contract. Empty is missing,
          not expired. Answers stay in Forms; a file is a Media id.
        </p>
        <form
          key={formKey}
          id="sf-onboarding-valid-until"
          action={action}
          className="sf-events-form-mosaic-form"
        >
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="drivingLicenceMediaId" value={licence.mediaId} />
          <input type="hidden" name="healthBookletMediaId" value={health.mediaId} />
          <input type="hidden" name="contractMediaId" value={contract.mediaId} />
          {ONBOARDING_DOCUMENT_KINDS.map((kind) => {
            const name =
              kind === 'driving_licence'
                ? 'drivingLicenceValidUntil'
                : kind === 'health_booklet'
                  ? 'healthBookletValidUntil'
                  : 'contractValidUntil'
            const value =
              kind === 'driving_licence'
                ? drivingLicenceValidUntil
                : kind === 'health_booklet'
                  ? healthBookletValidUntil
                  : contractValidUntil
            const setValue =
              kind === 'driving_licence'
                ? setDrivingLicenceValidUntil
                : kind === 'health_booklet'
                  ? setHealthBookletValidUntil
                  : setContractValidUntil
            return (
              <label key={kind} className="settings-field">
                <span>{ONBOARDING_DOCUMENT_KIND_LABELS[kind]}</span>
                <input
                  type="date"
                  name={name}
                  value={value}
                  disabled={pending}
                  onChange={(e) => setValue(e.target.value)}
                />
                <span className="settings-hint">{hintFor(value)}</span>
              </label>
            )
          })}
        </form>
        <Feedback state={state} />
        <div className="page-settings-actions admin-action-row">
          <button
            type="submit"
            form="sf-onboarding-valid-until"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={pending}
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PersonStatusPanel({
  userId,
  statusId,
  statusOptions,
}: {
  userId: string
  statusId: string
  statusOptions: StatusOption[]
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updateOnboardingPersonStatusAction, initial)
  const [selected, setSelected] = useState(statusId)

  useNotifySavedOnOk(state)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])
  useEffect(() => {
    setSelected(statusId)
  }, [statusId])

  return (
    <div className="page-settings-panel" key={`status-${statusId}`}>
      <div className="page-settings-panel-head">
        <h3>Main status</h3>
      </div>
      <div className="page-settings-panel-body">
        <form id="sf-onboarding-person-status" action={action}>
          <input type="hidden" name="userId" value={userId} />
          <label className="settings-field">
            <span>Status</span>
            <select
              name="statusId"
              value={selected}
              disabled={pending}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Select…</option>
              {statusOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="settings-hint">
              Moving onto a completed status for an event type sets that open event’s outcome to
              passed.
            </span>
          </label>
        </form>
        <Feedback state={state} />
        <div className="page-settings-actions admin-action-row">
          <button
            type="submit"
            form="sf-onboarding-person-status"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={pending}
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function PersonManager({
  userId,
  statusId,
  statusOptions,
  tagOptions,
  events,
  notes,
  followUps,
  calls,
  mailLogs,
  documentSlots,
  outcomeOptions,
}: Props) {
  const router = useRouter()
  const [noteState, noteAction, notePending] = useActionState(createOnboardingNoteAction, initial)
  const [followState, followAction, followPending] = useActionState(
    saveOnboardingFollowUpAction,
    initial,
  )
  const [callState, callAction, callPending] = useActionState(createOnboardingCallAction, initial)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [reminderStatus, setReminderStatus] = useState(followUps[0]?.reminderStatus ?? 'open')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(followUps[0]?.tags ?? [])
  const [callDone, setCallDone] = useState(false)
  const [callDue, setCallDue] = useState(false)

  useNotifySavedOnOk(noteState)
  useNotifySavedOnOk(followState)
  useNotifySavedOnOk(callState)
  useEffect(() => {
    if (noteState.ok || followState.ok || callState.ok) {
      setAddEventOpen(false)
      router.refresh()
    }
  }, [noteState.ok, followState.ok, callState.ok, router])

  useEffect(() => {
    setReminderStatus(followUps[0]?.reminderStatus ?? 'open')
    setSelectedTagIds(followUps[0]?.tags ?? [])
  }, [followUps])

  return (
    <div className="sf-onboarding-person">
      <div className="admin-settings-mosaic">
        <PersonStatusPanel
          userId={userId}
          statusId={statusId}
          statusOptions={statusOptions}
        />
        <ValidUntilPanel userId={userId} documentSlots={documentSlots} />

        <div className="page-settings-panel" style={{ gridColumn: '1 / -1' }}>
          <div className="page-settings-panel-head">
            <h3>Events</h3>
            <button
              type="button"
              className={`gantry-toolbar-btn${addEventOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
              onClick={() => setAddEventOpen((v) => !v)}
            >
              {addEventOpen ? 'Close' : 'Add event +'}
            </button>
          </div>
          <div className="page-settings-panel-body">
            {addEventOpen ? (
              <EventCard
                userId={userId}
                outcomes={outcomeOptions.ridealong}
              />
            ) : null}
            {events.length === 0 && !addEventOpen ? (
              <p className="settings-hint">No events yet.</p>
            ) : null}
            {events.map((event) => (
              <EventCard
                key={event.id}
                userId={userId}
                event={event}
                outcomes={outcomeOptions[event.kind] ?? ['email_sent']}
              />
            ))}
          </div>
        </div>

        <div className="page-settings-panel">
          <div className="page-settings-panel-head">
            <h3>Notes</h3>
          </div>
          <div className="page-settings-panel-body">
            <ul className="settings-hint">
              {notes.map((n) => (
                <li key={n.id}>
                  <time dateTime={n.createdAt}>{n.createdAt}</time>
                  {' — '}
                  {n.body}
                </li>
              ))}
            </ul>
            <form action={noteAction}>
              <input type="hidden" name="userId" value={userId} />
              <label className="settings-field">
                <span>New note</span>
                <textarea name="body" required disabled={notePending} rows={3} />
              </label>
              <Feedback state={noteState} />
              <div className="page-settings-actions admin-action-row">
                <button
                  type="submit"
                  className="gantry-toolbar-btn gantry-toolbar-btn-save"
                  disabled={notePending}
                >
                  {notePending ? 'Saving…' : 'Add note'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="page-settings-panel">
          <div className="page-settings-panel-head">
            <h3>Follow-up</h3>
          </div>
          <div className="page-settings-panel-body">
            <form
              action={followAction}
              key={`${followUps[0]?.id ?? 'new-follow'}:${(followUps[0]?.tags ?? []).join(',')}`}
            >
              <input type="hidden" name="userId" value={userId} />
              {followUps[0] ? <input type="hidden" name="id" value={followUps[0].id} /> : null}
              <fieldset className="settings-field" disabled={followPending}>
                <legend>Tags</legend>
                <span className="settings-hint">
                  Catalog marks only — they do not change status. Manage the list under Settings.
                </span>
                {tagOptions.length === 0 ? (
                  <p className="settings-hint">No tags yet. Add them under Onboarding settings.</p>
                ) : (
                  <ul
                    className="admin-inline-actions"
                    style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}
                  >
                    {tagOptions.map((tag) => {
                      const checked = selectedTagIds.includes(tag.id)
                      return (
                        <li key={tag.id} className="settings-field settings-flag">
                          <label>
                            <input
                              type="checkbox"
                              name="tagIds"
                              value={tag.id}
                              checked={checked}
                              disabled={followPending}
                              onChange={() => {
                                if (checked) {
                                  setSelectedTagIds((prev) => prev.filter((id) => id !== tag.id))
                                } else {
                                  setSelectedTagIds((prev) => [...prev, tag.id])
                                }
                              }}
                            />
                            <span
                              aria-hidden
                              style={{
                                display: 'inline-block',
                                width: '0.7rem',
                                height: '0.7rem',
                                borderRadius: '2px',
                                marginRight: '0.35rem',
                                background: tag.color || '#64748b',
                                opacity: tag.fade ? 0.45 : 1,
                              }}
                            />
                            <span>
                              {tag.label}
                              {tag.todo ? ' (to-do)' : ''}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </fieldset>
              <label className="settings-field">
                <span>Short note</span>
                <input
                  type="text"
                  name="note"
                  defaultValue={followUps[0]?.note ?? ''}
                  disabled={followPending}
                />
              </label>
              <label className="settings-field">
                <span>Reminder status</span>
                <select
                  name="reminderStatus"
                  value={reminderStatus}
                  disabled={followPending}
                  onChange={(e) => setReminderStatus(e.target.value)}
                >
                  <option value="open">open</option>
                  <option value="sent">sent</option>
                  <option value="done">done</option>
                </select>
              </label>
              <Feedback state={followState} />
              <div className="page-settings-actions admin-action-row">
                <button
                  type="submit"
                  className="gantry-toolbar-btn gantry-toolbar-btn-save"
                  disabled={followPending}
                >
                  {followPending ? 'Saving…' : 'Save follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="page-settings-panel">
          <div className="page-settings-panel-head">
            <h3>Calls</h3>
          </div>
          <div className="page-settings-panel-body">
            <ul className="settings-hint">
              {calls.map((c) => (
                <li key={c.id}>
                  {c.callAt || 'unscheduled'}
                  {c.done ? ' · done' : ''}
                  {c.dueNotice ? ' · due notice' : ''}
                  <CallDoneForm userId={userId} call={c} />
                </li>
              ))}
            </ul>
            <form action={callAction}>
              <input type="hidden" name="userId" value={userId} />
              <label className="settings-field">
                <span>Call at</span>
                <input type="datetime-local" name="callAt" disabled={callPending} />
              </label>
              <label className="settings-field settings-flag">
                <span>Done</span>
                <input
                  type="checkbox"
                  name="done"
                  value="1"
                  checked={callDone}
                  disabled={callPending}
                  onChange={(e) => setCallDone(e.target.checked)}
                />
              </label>
              <label className="settings-field settings-flag">
                <span>Due notice</span>
                <input
                  type="checkbox"
                  name="dueNotice"
                  value="1"
                  checked={callDue}
                  disabled={callPending}
                  onChange={(e) => setCallDue(e.target.checked)}
                />
              </label>
              <Feedback state={callState} />
              <div className="page-settings-actions admin-action-row">
                <button
                  type="submit"
                  className="gantry-toolbar-btn gantry-toolbar-btn-save"
                  disabled={callPending}
                >
                  {callPending ? 'Saving…' : 'Log call'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="page-settings-panel">
          <div className="page-settings-panel-head">
            <h3>Mail log</h3>
          </div>
          <div className="page-settings-panel-body">
            {mailLogs.length === 0 ? (
              <p className="settings-hint">No mail logged yet.</p>
            ) : (
              <ul className="settings-hint">
                {mailLogs.map((m) => (
                  <li key={m.id}>
                    <strong>{m.channel}</strong> — {m.subject} → {m.toEmail}
                    <div>
                      <time dateTime={m.sentAt}>{m.sentAt}</time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CallDoneForm({ userId, call }: { userId: string; call: CallRow }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updateOnboardingCallAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])
  if (call.done) return null
  return (
    <form action={action} style={{ display: 'inline', marginLeft: '0.5rem' }}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="callId" value={call.id} />
      <input type="hidden" name="done" value="1" />
      <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-muted" disabled={pending}>
        Mark done
      </button>
    </form>
  )
}

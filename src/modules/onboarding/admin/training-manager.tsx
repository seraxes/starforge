'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  createOnboardingTrainerSlotAction,
  recordOnboardingQuizAttemptAction,
  saveOnboardingTrainerAction,
  saveOnboardingTrainingReportAction,
  updateOnboardingTrainerSlotAction,
  type OnboardingAdminActionState,
} from '../actions'
import {
  TRAINING_CHECKLIST_SECTIONS,
  emptyTrainingChecklist,
  type TrainingChecklistLevel,
  type TrainingChecklistSection,
  type TrainingPassedValue,
  type TrainingReportStatus,
  type TrainerSlotKind,
  type TrainerSlotStatus,
} from '../training-rules'

const initial: OnboardingAdminActionState = {}

type PersonOpt = { userId: string; label: string; statusId: string; statusName: string }

type ReportRow = {
  id: string
  traineeUserId: string
  instructorUserId: string
  reportDate: string
  depotKey: string
  depotLabel: string
  trainingDay: string
  plate: string
  rounds: number
  drove: boolean
  status: TrainingReportStatus
  passed: TrainingPassedValue
  note: string
  checklist: TrainingChecklistSection[]
  mediaId: string
}

type SlotRow = {
  id: string
  instructorUserId: string
  slotDate: string
  slotIndex: number
  startTime: string
  locationCode: string
  traineeUserId: string
  kind: TrainerSlotKind
  status: TrainerSlotStatus
}

type TrainerRow = { id: string; name: string; phone: string; linkedUserId: string }

type QualRow = {
  id: string
  userId: string
  source: string
  qualifiedDate: string
  createdAt: string
}

type Props = {
  people: PersonOpt[]
  reports: ReportRow[]
  slots: SlotRow[]
  trainers: TrainerRow[]
  qualifications: QualRow[]
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

function personLabel(people: PersonOpt[], userId: string): string {
  const id = userId.trim()
  if (!id) return '—'
  return people.find((p) => p.userId === id)?.label || id
}

function normalizeChecklist(raw: TrainingChecklistSection[] | undefined): TrainingChecklistSection[] {
  if (Array.isArray(raw) && raw.length === 14) {
    return TRAINING_CHECKLIST_SECTIONS.map((catalog, i) => {
      const row = raw[i]
      return {
        key: row?.key || catalog.key,
        label: row?.label || catalog.label,
        level: (row?.level || '') as TrainingChecklistLevel | '',
        note: row?.note || '',
      }
    })
  }
  return emptyTrainingChecklist()
}

function ReportForm({
  people,
  report,
}: {
  people: PersonOpt[]
  report?: ReportRow
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [state, action, pending] = useActionState(saveOnboardingTrainingReportAction, initial)
  useNotifySavedOnOk(state)

  const [traineeUserId, setTraineeUserId] = useState(report?.traineeUserId ?? '')
  const [instructorUserId, setInstructorUserId] = useState(report?.instructorUserId ?? '')
  const [reportDate, setReportDate] = useState(report?.reportDate ?? '')
  const [depotKey, setDepotKey] = useState(report?.depotKey ?? '')
  const [depotLabel, setDepotLabel] = useState(report?.depotLabel ?? '')
  const [trainingDay, setTrainingDay] = useState(report?.trainingDay ?? '')
  const [plate, setPlate] = useState(report?.plate ?? '')
  const [rounds, setRounds] = useState(String(report?.rounds ?? 0))
  const [drove, setDrove] = useState(report?.drove === true)
  const [status, setStatus] = useState<TrainingReportStatus>(report?.status ?? 'open')
  const [passed, setPassed] = useState<TrainingPassedValue>(report?.passed ?? '')
  const [note, setNote] = useState(report?.note ?? '')
  const [checklist, setChecklist] = useState(() => normalizeChecklist(report?.checklist))

  useEffect(() => {
    setTraineeUserId(report?.traineeUserId ?? '')
    setInstructorUserId(report?.instructorUserId ?? '')
    setReportDate(report?.reportDate ?? '')
    setDepotKey(report?.depotKey ?? '')
    setDepotLabel(report?.depotLabel ?? '')
    setTrainingDay(report?.trainingDay ?? '')
    setPlate(report?.plate ?? '')
    setRounds(String(report?.rounds ?? 0))
    setDrove(report?.drove === true)
    setStatus(report?.status ?? 'open')
    setPassed(report?.passed ?? '')
    setNote(report?.note ?? '')
    setChecklist(normalizeChecklist(report?.checklist))
  }, [report])

  useEffect(() => {
    if (!state.ok) return
    setFormKey((k) => k + 1)
    if (!report) {
      setOpen(false)
      setTraineeUserId('')
      setInstructorUserId('')
      setReportDate('')
      setDepotKey('')
      setDepotLabel('')
      setTrainingDay('')
      setPlate('')
      setRounds('0')
      setDrove(false)
      setStatus('open')
      setPassed('')
      setNote('')
      setChecklist(emptyTrainingChecklist())
    }
    router.refresh()
  }, [state.ok, report, router])

  const formId = report ? `sf-onboarding-report-${report.id}` : 'sf-onboarding-report-new'
  const traineeStatus = people.find((p) => p.userId === traineeUserId)

  if (report && !open) {
    return (
      <div className="page-settings-panel" style={{ marginBottom: '1rem' }}>
        <div className="page-settings-panel-head admin-control-row">
          <strong>
            {personLabel(people, report.traineeUserId)} · {report.reportDate || 'no date'}
          </strong>
          <span className="settings-hint">
            {report.passed || '—'} · {report.status}
            {report.mediaId ? ` · PDF ${report.mediaId.slice(0, 8)}…` : ''}
          </span>
          <button
            type="button"
            className="gantry-toolbar-btn"
            onClick={() => setOpen(true)}
          >
            Edit
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`sf-onboarding-add-panel${open || report ? ' is-open' : ''}`}>
      {!report ? (
        <section className="outlines-create sf-events-add-panel">
          <div className="sf-events-add-bar">
            <button
              type="button"
              className={`gantry-toolbar-btn${open ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'Close' : 'Report +'}
            </button>
            {!open ? (
              <p className="settings-hint sf-events-add-hint">
                Save a 14-section checklist. Pass records a qualification without moving status.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
      {open || report ? (
        <div className="sf-events-form-mosaic">
          <form
            key={formKey}
            id={formId}
            action={action}
            aria-label={report ? 'Edit training report' : 'New training report'}
            className="sf-events-form-mosaic-form"
          >
            {report ? <input type="hidden" name="id" value={report.id} /> : null}
            <input type="hidden" name="checklistJson" value={JSON.stringify(checklist)} />
            <fieldset className="settings-fieldset sf-events-form-section sf-events-form-section-wide">
              <legend>{report ? 'Edit report' : 'New report'}</legend>
              <label className="settings-field">
                <span>Trainee</span>
                <select
                  name="traineeUserId"
                  value={traineeUserId}
                  required
                  disabled={pending}
                  onChange={(e) => setTraineeUserId(e.target.value)}
                >
                  <option value="">Select person…</option>
                  {people.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.label}
                      {p.statusName ? ` (${p.statusName})` : ''}
                    </option>
                  ))}
                </select>
                {traineeStatus ? (
                  <span className="settings-hint">
                    Current status: {traineeStatus.statusName || traineeStatus.statusId || '—'} (unchanged
                    on pass)
                  </span>
                ) : null}
              </label>
              <label className="settings-field">
                <span>Instructor user id</span>
                <select
                  name="instructorUserId"
                  value={instructorUserId}
                  disabled={pending}
                  onChange={(e) => setInstructorUserId(e.target.value)}
                >
                  <option value="">—</option>
                  {people.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-field">
                <span>Date</span>
                <input
                  type="date"
                  name="reportDate"
                  value={reportDate}
                  disabled={pending}
                  onChange={(e) => setReportDate(e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>Depot key</span>
                <input
                  type="text"
                  name="depotKey"
                  value={depotKey}
                  disabled={pending}
                  autoComplete="off"
                  onChange={(e) => setDepotKey(e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>Depot label</span>
                <input
                  type="text"
                  name="depotLabel"
                  value={depotLabel}
                  disabled={pending}
                  autoComplete="off"
                  onChange={(e) => setDepotLabel(e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>Training day</span>
                <input
                  type="text"
                  name="trainingDay"
                  value={trainingDay}
                  disabled={pending}
                  autoComplete="off"
                  onChange={(e) => setTrainingDay(e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>Plate</span>
                <input
                  type="text"
                  name="plate"
                  value={plate}
                  disabled={pending}
                  autoComplete="off"
                  onChange={(e) => setPlate(e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>Rounds</span>
                <input
                  type="number"
                  name="rounds"
                  min={0}
                  step={1}
                  value={rounds}
                  disabled={pending}
                  onChange={(e) => setRounds(e.target.value)}
                />
              </label>
              <label className="settings-field settings-flag">
                <span>Drove</span>
                <input type="hidden" name="drove" value={drove ? '1' : '0'} />
                <input
                  type="checkbox"
                  checked={drove}
                  disabled={pending}
                  onChange={(e) => setDrove(e.target.checked)}
                />
              </label>
              <label className="settings-field">
                <span>Status</span>
                <select
                  name="status"
                  value={status}
                  disabled={pending}
                  onChange={(e) => setStatus(e.target.value as TrainingReportStatus)}
                >
                  <option value="open">open</option>
                  <option value="closed">closed</option>
                </select>
              </label>
              <label className="settings-field">
                <span>Passed</span>
                <select
                  name="passed"
                  value={passed}
                  disabled={pending}
                  onChange={(e) => setPassed(e.target.value as TrainingPassedValue)}
                >
                  <option value="">(empty)</option>
                  <option value="yes">yes</option>
                  <option value="no">no</option>
                  <option value="partial">partial</option>
                </select>
              </label>
              <label className="settings-field">
                <span>Note</span>
                <textarea
                  name="note"
                  value={note}
                  disabled={pending}
                  rows={2}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </fieldset>
            <fieldset className="settings-fieldset sf-events-form-section sf-events-form-section-wide">
              <legend>Checklist (14)</legend>
              {checklist.map((section, index) => (
                <div key={section.key} className="admin-control-row" style={{ marginBottom: '0.5rem' }}>
                  <label className="settings-field" style={{ flex: 1, margin: 0 }}>
                    <span>{section.label}</span>
                    <select
                      value={section.level}
                      disabled={pending}
                      aria-label={`${section.label} level`}
                      onChange={(e) => {
                        const level = e.target.value as TrainingChecklistLevel | ''
                        setChecklist((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, level } : row)),
                        )
                      }}
                    >
                      <option value="">—</option>
                      <option value="shown">shown</option>
                      <option value="practiced">practiced</option>
                      <option value="independent">independent</option>
                    </select>
                  </label>
                  <label className="settings-field" style={{ flex: 1, margin: 0 }}>
                    <span className="sr-only">Note</span>
                    <input
                      type="text"
                      value={section.note}
                      disabled={pending}
                      placeholder="Note"
                      autoComplete="off"
                      onChange={(e) => {
                        const nextNote = e.target.value
                        setChecklist((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, note: nextNote } : row)),
                        )
                      }}
                    />
                  </label>
                </div>
              ))}
            </fieldset>
          </form>
          <Feedback state={state} />
          <div className="sf-events-form-actions admin-action-row page-settings-actions">
            {report ? (
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              form={formId}
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={pending}
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function QuizAttemptPanel({ people }: { people: PersonOpt[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [userId, setUserId] = useState('')
  const [formDefinitionId, setFormDefinitionId] = useState('')
  const [attemptId, setAttemptId] = useState('')
  const [passed, setPassed] = useState(false)
  const [resultNote, setResultNote] = useState('')
  const [state, action, pending] = useActionState(recordOnboardingQuizAttemptAction, initial)
  useNotifySavedOnOk(state)

  useEffect(() => {
    if (!state.ok) return
    setOpen(false)
    setFormKey((k) => k + 1)
    setUserId('')
    setFormDefinitionId('')
    setAttemptId('')
    setPassed(false)
    setResultNote('')
    router.refresh()
  }, [state.ok, router])

  return (
    <div className={`sf-onboarding-add-panel${open ? ' is-open' : ''}`}>
      <section className="outlines-create sf-events-add-panel">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${open ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Close' : 'Quiz attempt +'}
          </button>
          {!open ? (
            <p className="settings-hint sf-events-add-hint">
              Record a Forms quiz attempt id and pass/fail. Questions stay in Forms.
            </p>
          ) : null}
        </div>
      </section>
      {open ? (
        <div className="sf-events-form-mosaic">
          <form
            key={formKey}
            id="sf-onboarding-quiz-form"
            action={action}
            className="sf-events-form-mosaic-form"
          >
            <fieldset className="settings-fieldset sf-events-form-section sf-events-form-section-wide">
              <legend>Quiz attempt</legend>
              <label className="settings-field">
                <span>Person</span>
                <select
                  name="userId"
                  value={userId}
                  required
                  disabled={pending}
                  onChange={(e) => setUserId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {people.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-field">
                <span>Form definition id</span>
                <input
                  type="text"
                  name="formDefinitionId"
                  value={formDefinitionId}
                  required
                  disabled={pending}
                  autoComplete="off"
                  onChange={(e) => setFormDefinitionId(e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>Attempt id</span>
                <input
                  type="text"
                  name="attemptId"
                  value={attemptId}
                  required
                  disabled={pending}
                  autoComplete="off"
                  onChange={(e) => setAttemptId(e.target.value)}
                />
              </label>
              <label className="settings-field settings-flag">
                <span>Passed</span>
                <input type="hidden" name="passed" value={passed ? '1' : '0'} />
                <input
                  type="checkbox"
                  checked={passed}
                  disabled={pending}
                  onChange={(e) => setPassed(e.target.checked)}
                />
              </label>
              <label className="settings-field">
                <span>Result note</span>
                <input
                  type="text"
                  name="resultNote"
                  value={resultNote}
                  disabled={pending}
                  autoComplete="off"
                  onChange={(e) => setResultNote(e.target.value)}
                />
              </label>
            </fieldset>
          </form>
          <Feedback state={state} />
          <div className="sf-events-form-actions admin-action-row page-settings-actions">
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="sf-onboarding-quiz-form"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={pending}
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TrainerPanel({ trainers }: { trainers: TrainerRow[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [linkedUserId, setLinkedUserId] = useState('')
  const [state, action, pending] = useActionState(saveOnboardingTrainerAction, initial)
  useNotifySavedOnOk(state)

  useEffect(() => {
    if (!state.ok) return
    setOpen(false)
    setFormKey((k) => k + 1)
    setName('')
    setPhone('')
    setLinkedUserId('')
    router.refresh()
  }, [state.ok, router])

  return (
    <div>
      <div className={`sf-onboarding-add-panel${open ? ' is-open' : ''}`}>
        <section className="outlines-create sf-events-add-panel">
          <div className="sf-events-add-bar">
            <button
              type="button"
              className={`gantry-toolbar-btn${open ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'Close' : 'Trainer +'}
            </button>
          </div>
        </section>
        {open ? (
          <div className="sf-events-form-mosaic">
            <form
              key={formKey}
              id="sf-onboarding-trainer-form"
              action={action}
              className="sf-events-form-mosaic-form"
            >
              <fieldset className="settings-fieldset sf-events-form-section sf-events-form-section-wide">
                <legend>Trainer</legend>
                <label className="settings-field">
                  <span>Name</span>
                  <input
                    type="text"
                    name="name"
                    value={name}
                    required
                    disabled={pending}
                    autoComplete="off"
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="settings-field">
                  <span>Phone</span>
                  <input
                    type="text"
                    name="phone"
                    value={phone}
                    disabled={pending}
                    autoComplete="off"
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
                <label className="settings-field">
                  <span>Linked Core user id</span>
                  <input
                    type="text"
                    name="linkedUserId"
                    value={linkedUserId}
                    disabled={pending}
                    autoComplete="off"
                    onChange={(e) => setLinkedUserId(e.target.value)}
                  />
                </label>
              </fieldset>
            </form>
            <Feedback state={state} />
            <div className="sf-events-form-actions admin-action-row page-settings-actions">
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="sf-onboarding-trainer-form"
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                disabled={pending}
              >
                {pending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {trainers.length > 0 ? (
        <div className="admin-table-wrap" style={{ marginTop: '1rem' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Linked user</th>
              </tr>
            </thead>
            <tbody>
              {trainers.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.phone || '—'}</td>
                  <td>{t.linkedUserId || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

function SlotForm({
  people,
  slot,
}: {
  people: PersonOpt[]
  slot?: SlotRow
}) {
  const router = useRouter()
  const isNew = !slot
  const saveAction = isNew ? createOnboardingTrainerSlotAction : updateOnboardingTrainerSlotAction
  const [state, action, pending] = useActionState(saveAction, initial)
  useNotifySavedOnOk(state)
  const [formKey, setFormKey] = useState(0)
  const [instructorUserId, setInstructorUserId] = useState(slot?.instructorUserId ?? '')
  const [slotDate, setSlotDate] = useState(slot?.slotDate ?? '')
  const [slotIndex, setSlotIndex] = useState(String(slot?.slotIndex ?? 1))
  const [startTime, setStartTime] = useState(slot?.startTime ?? '')
  const [locationCode, setLocationCode] = useState(slot?.locationCode ?? '')
  const [traineeUserId, setTraineeUserId] = useState(slot?.traineeUserId ?? '')
  const [kind, setKind] = useState<TrainerSlotKind>(slot?.kind ?? 'ridealong')
  const [status, setStatus] = useState<TrainerSlotStatus>(slot?.status ?? 'pending')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setInstructorUserId(slot?.instructorUserId ?? '')
    setSlotDate(slot?.slotDate ?? '')
    setSlotIndex(String(slot?.slotIndex ?? 1))
    setStartTime(slot?.startTime ?? '')
    setLocationCode(slot?.locationCode ?? '')
    setTraineeUserId(slot?.traineeUserId ?? '')
    setKind(slot?.kind ?? 'ridealong')
    setStatus(slot?.status ?? 'pending')
  }, [slot])

  useEffect(() => {
    if (!state.ok) return
    setFormKey((k) => k + 1)
    if (isNew) {
      setOpen(false)
      setInstructorUserId('')
      setSlotDate('')
      setSlotIndex('1')
      setStartTime('')
      setLocationCode('')
      setTraineeUserId('')
      setKind('ridealong')
      setStatus('pending')
    }
    router.refresh()
  }, [state.ok, isNew, router])

  const formId = slot ? `sf-onboarding-slot-${slot.id}` : 'sf-onboarding-slot-new'

  if (!isNew && !open) {
    return (
      <tr>
        <td>{personLabel(people, slot.instructorUserId)}</td>
        <td>{slot.slotDate || '—'}</td>
        <td>{slot.slotIndex}</td>
        <td>{slot.startTime || '—'}</td>
        <td>{slot.kind}</td>
        <td>{slot.status}</td>
        <td>{personLabel(people, slot.traineeUserId)}</td>
        <td>
          <button type="button" className="gantry-toolbar-btn" onClick={() => setOpen(true)}>
            Edit
          </button>
        </td>
      </tr>
    )
  }

  if (!isNew && open) {
    return (
      <tr>
        <td colSpan={8}>
          <form key={formKey} id={formId} action={action}>
            <input type="hidden" name="slotId" value={slot.id} />
            <div className="admin-settings-mosaic">
              <label className="settings-field">
                <span>Instructor</span>
                <select
                  name="instructorUserId"
                  value={instructorUserId}
                  required
                  disabled={pending}
                  onChange={(e) => setInstructorUserId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {people.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-field">
                <span>Date</span>
                <input
                  type="date"
                  name="slotDate"
                  value={slotDate}
                  disabled={pending}
                  onChange={(e) => setSlotDate(e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>Slot index (1–3)</span>
                <select
                  name="slotIndex"
                  value={slotIndex}
                  disabled={pending}
                  onChange={(e) => setSlotIndex(e.target.value)}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </label>
              <label className="settings-field">
                <span>Start time</span>
                <input
                  type="text"
                  name="startTime"
                  value={startTime}
                  disabled={pending}
                  placeholder="09:00"
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>Location code</span>
                <input
                  type="text"
                  name="locationCode"
                  value={locationCode}
                  disabled={pending}
                  onChange={(e) => setLocationCode(e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>Trainee</span>
                <select
                  name="traineeUserId"
                  value={traineeUserId}
                  disabled={pending}
                  onChange={(e) => setTraineeUserId(e.target.value)}
                >
                  <option value="">—</option>
                  {people.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-field">
                <span>Kind</span>
                <select
                  name="kind"
                  value={kind}
                  disabled={pending}
                  onChange={(e) => setKind(e.target.value as TrainerSlotKind)}
                >
                  <option value="ridealong">ridealong</option>
                  <option value="induction">induction</option>
                </select>
              </label>
              <label className="settings-field">
                <span>Status</span>
                <select
                  name="status"
                  value={status}
                  disabled={pending}
                  onChange={(e) => setStatus(e.target.value as TrainerSlotStatus)}
                >
                  <option value="pending">pending</option>
                  <option value="accepted">accepted</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </label>
            </div>
          </form>
          <Feedback state={state} />
          <div className="sf-events-form-actions admin-action-row page-settings-actions">
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form={formId}
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={pending}
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className={`sf-onboarding-add-panel${open ? ' is-open' : ''}`}>
      <section className="outlines-create sf-events-add-panel">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${open ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Close' : 'Slot +'}
          </button>
          {!open ? (
            <p className="settings-hint sf-events-add-hint">
              Max 3 slots per instructor per day. Index 4 is refused.
            </p>
          ) : null}
        </div>
      </section>
      {open ? (
        <div className="sf-events-form-mosaic">
          <form
            key={formKey}
            id={formId}
            action={action}
            className="sf-events-form-mosaic-form"
          >
            <fieldset className="settings-fieldset sf-events-form-section sf-events-form-section-wide">
              <legend>Trainer slot</legend>
              <label className="settings-field">
                <span>Instructor</span>
                <select
                  name="instructorUserId"
                  value={instructorUserId}
                  required
                  disabled={pending}
                  onChange={(e) => setInstructorUserId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {people.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-field">
                <span>Date</span>
                <input
                  type="date"
                  name="slotDate"
                  value={slotDate}
                  disabled={pending}
                  onChange={(e) => setSlotDate(e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>Slot index (1–3)</span>
                <select
                  name="slotIndex"
                  value={slotIndex}
                  disabled={pending}
                  onChange={(e) => setSlotIndex(e.target.value)}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </label>
              <label className="settings-field">
                <span>Start time</span>
                <input
                  type="text"
                  name="startTime"
                  value={startTime}
                  disabled={pending}
                  placeholder="09:00"
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>Location code</span>
                <input
                  type="text"
                  name="locationCode"
                  value={locationCode}
                  disabled={pending}
                  onChange={(e) => setLocationCode(e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>Trainee</span>
                <select
                  name="traineeUserId"
                  value={traineeUserId}
                  disabled={pending}
                  onChange={(e) => setTraineeUserId(e.target.value)}
                >
                  <option value="">—</option>
                  {people.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-field">
                <span>Kind</span>
                <select
                  name="kind"
                  value={kind}
                  disabled={pending}
                  onChange={(e) => setKind(e.target.value as TrainerSlotKind)}
                >
                  <option value="ridealong">ridealong</option>
                  <option value="induction">induction</option>
                </select>
              </label>
              <label className="settings-field">
                <span>Status</span>
                <select
                  name="status"
                  value={status}
                  disabled={pending}
                  onChange={(e) => setStatus(e.target.value as TrainerSlotStatus)}
                >
                  <option value="pending">pending</option>
                  <option value="accepted">accepted</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </label>
            </fieldset>
          </form>
          <Feedback state={state} />
          <div className="sf-events-form-actions admin-action-row page-settings-actions">
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form={formId}
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={pending}
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function TrainingManager({
  people,
  reports,
  slots,
  trainers,
  qualifications,
}: Props) {
  return (
    <div className="sf-onboarding-training">
      <div className="admin-settings-mosaic">
        <div className="page-settings-panel">
          <div className="page-settings-panel-head">
            <h3>Reports</h3>
          </div>
          <div className="page-settings-panel-body">
            <ReportForm people={people} />
            <div style={{ marginTop: '1rem' }}>
              <QuizAttemptPanel people={people} />
            </div>
            {reports.length === 0 ? (
              <p className="settings-hint" style={{ marginTop: '1rem' }}>
                No training reports yet.
              </p>
            ) : (
              <div style={{ marginTop: '1rem' }}>
                {reports.map((report) => (
                  <ReportForm key={report.id} people={people} report={report} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="page-settings-panel">
          <div className="page-settings-panel-head">
            <h3>Trainer calendar</h3>
          </div>
          <div className="page-settings-panel-body">
            <TrainerPanel trainers={trainers} />
            <div style={{ marginTop: '1rem' }}>
              <SlotForm people={people} />
            </div>
            {slots.length > 0 ? (
              <div className="admin-table-wrap" style={{ marginTop: '1rem' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Instructor</th>
                      <th>Date</th>
                      <th>Index</th>
                      <th>Start</th>
                      <th>Kind</th>
                      <th>Status</th>
                      <th>Trainee</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((slot) => (
                      <SlotForm key={slot.id} people={people} slot={slot} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="settings-hint" style={{ marginTop: '1rem' }}>
                No trainer slots yet.
              </p>
            )}
          </div>
        </div>

        <div className="page-settings-panel">
          <div className="page-settings-panel-head">
            <h3>Qualifications</h3>
          </div>
          <div className="page-settings-panel-body">
            {qualifications.length === 0 ? (
              <p className="settings-hint">
                No qualifications yet. A checklist pass or quiz pass records a date here without
                moving status.
              </p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Source</th>
                      <th>Qualified date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qualifications.map((q) => (
                      <tr key={q.id}>
                        <td>{personLabel(people, q.userId)}</td>
                        <td>{q.source}</td>
                        <td>{q.qualifiedDate || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

'use server'

import { revalidatePath } from '@/core/content/defer-revalidate'

import { requireAdminArea } from '@/core/acl/access'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { createDepot, deleteDepot, updateDepot } from './depot-store'
import { createTag, deleteTag, updateTag } from './tag-store'
import { ONBOARDING_EMAIL_EVENT_TYPES } from './email-binding-rules'
import { seedOnboardingEmailStarters } from './email-starters'
import { invitePersonWithRuntime } from './invite-runtime'
import {
  createCall,
  createEvent,
  createNote,
  setEventOutcome,
  updateCall,
  updateEvent,
  upsertFollowUp,
} from './procedure-store'
import { saveOnboardingModuleSettings } from './settings'
import {
  createStatus,
  deleteStatus,
  ensureSeededStatuses,
  getStatusById,
  listStatuses,
  reorderStatuses,
  updateStatus,
  writeIdentityFacts,
} from './store'
import {
  createTrainerSlot,
  recordQuizAttempt,
  saveTrainingReport,
  updateTrainerSlot,
  upsertTrainer,
} from './training-store'
import { emptyTrainingChecklist } from './training-rules'
import { savePersonValidUntilDates } from './valid-until-store'

export type OnboardingAdminActionState = {
  error?: string
  ok?: boolean
  message?: string
  userId?: string
  /** Forms definition id after Create on a status with no form. */
  formId?: string
}

async function requireOnboardingAdmin(): Promise<
  | { denied: OnboardingAdminActionState; session: null }
  | { denied: null; session: { user: { id: string } } }
> {
  const session = await requireAdminArea('admin.onboarding', 'edit')
  if (!session?.user?.id) {
    return {
      denied: {
        error:
          'Sign in with Onboarding admin access (app admin or ACL → Onboarding) to manage people.',
      },
      session: null,
    }
  }
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.onboarding)) {
    return {
      denied: { error: 'Onboarding is disabled. Enable it under Settings → Modules.' },
      session: null,
    }
  }
  return { denied: null, session: { user: { id: session.user.id } } }
}

function revalidateOnboardingAdmin(userId?: string) {
  revalidatePath('/admin/onboarding')
  revalidatePath('/admin/onboarding/statuses')
  revalidatePath('/admin/onboarding/settings')
  revalidatePath('/admin/onboarding/training')
  if (userId) revalidatePath(`/admin/onboarding/people/${userId}`)
}

function parseChecklistFromForm(formData: FormData) {
  const raw = formData.get('checklistJson')
  if (typeof raw === 'string' && raw.trim()) return raw
  return JSON.stringify(emptyTrainingChecklist())
}

export async function createOnboardingStatusAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  await ensureSeededStatuses()
  const existing = await listStatuses()
  const sortRaw = formData.get('sortOrder')
  const sortBlank = sortRaw == null || String(sortRaw).trim() === ''
  const nextSort =
    existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1
  const result = await createStatus({
    name: formData.get('name'),
    key: formData.get('key'),
    phase: formData.get('phase'),
    displayLabel: formData.get('displayLabel'),
    actionChip: formData.get('actionChip'),
    nextStepMessage: formData.get('nextStepMessage'),
    formDefinitionId: formData.get('formDefinitionId'),
    reminderTemplateId: formData.get('reminderTemplateId'),
    sortOrder: sortBlank ? nextSort : sortRaw,
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin()
  return { ok: true, message: 'Status created.' }
}

export async function updateOnboardingStatusAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing status id.' }

  const result = await updateStatus(id, {
    name: formData.get('name'),
    key: formData.get('key'),
    phase: formData.get('phase'),
    displayLabel: formData.get('displayLabel'),
    actionChip: formData.get('actionChip'),
    nextStepMessage: formData.get('nextStepMessage'),
    formDefinitionId: formData.get('formDefinitionId'),
    reminderTemplateId: formData.get('reminderTemplateId'),
    sortOrder: formData.get('sortOrder'),
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin()
  return { ok: true, message: 'Status saved.' }
}

/**
 * When a status has no Forms definition, Create builds one through the Forms
 * public door, stores the id on the status, and returns it so the Edit dialog can open.
 */
export async function createOnboardingStatusFormAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const statusId = String(formData.get('statusId') ?? '').trim()
  if (!statusId) return { error: 'Missing status id.' }

  const existing = await getStatusById(statusId)
  if (!existing) return { error: 'Status not found.' }

  const already = existing.formDefinitionId.trim()
  if (already) {
    return { ok: true, formId: already, message: 'Form already linked.' }
  }

  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    return { error: 'Forms is disabled. Enable it under Settings → Modules.' }
  }

  const statusName =
    String(formData.get('statusName') ?? '').trim() || existing.name || existing.key
  const label = `${statusName} form`.trim() || 'Onboarding form'

  let createdId: string
  try {
    const { createFormDefinition } = await import('@/modules/forms/api')
    const created = await createFormDefinition({
      label,
      preset: 'blank',
    })
    createdId = created.id
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not create form.',
    }
  }

  const result = await updateStatus(statusId, { formDefinitionId: createdId })
  if (!result.ok) return { error: result.error }

  revalidateOnboardingAdmin()
  revalidatePath('/admin/forms')
  revalidatePath(`/admin/forms/${createdId}`)
  return { ok: true, formId: createdId, message: 'Form created.' }
}

function readStatusIdList(formData: FormData, name: string): string[] {
  const all = formData.getAll(name).map((value) => String(value ?? '').trim()).filter(Boolean)
  if (all.length > 0) return all
  const raw = String(formData.get(name) ?? '').trim()
  if (!raw) return []
  return raw
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function readEventTypeSettingsFromForm(formData: FormData) {
  const eventTypeSettings: Record<
    string,
    {
      formDefinitionId: string
      dateFieldNames: string[]
      activeStatusIds: string[]
      completedStatusIds: string[]
    }
  > = {}
  for (const kind of ONBOARDING_EMAIL_EVENT_TYPES) {
    const dateRaw = String(formData.get(`eventDateFields_${kind}`) ?? '')
    eventTypeSettings[kind] = {
      formDefinitionId: String(formData.get(`eventFormDefinitionId_${kind}`) ?? ''),
      dateFieldNames: dateRaw
        .split(/[\n,]/)
        .map((part) => part.trim())
        .filter(Boolean),
      activeStatusIds: readStatusIdList(formData, `eventActiveStatusIds_${kind}`),
      completedStatusIds: readStatusIdList(formData, `eventCompletedStatusIds_${kind}`),
    }
  }
  return eventTypeSettings
}

export async function saveOnboardingSettingsAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const result = await saveOnboardingModuleSettings({
    inviteTemplateId: formData.get('inviteTemplateId'),
    eventTemplateIds: {
      ridealong: formData.get('eventTemplateId_ridealong'),
      testday: formData.get('eventTemplateId_testday'),
      trialday: formData.get('eventTemplateId_trialday'),
    },
    eventTypeSettings: readEventTypeSettingsFromForm(formData),
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin()
  return { ok: true, message: 'Onboarding settings saved.' }
}

export async function createOnboardingDepotAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const result = await createDepot({
    name: formData.get('name'),
    address: formData.get('address'),
    sortOrder: formData.get('sortOrder'),
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin()
  return { ok: true, message: 'Depot created.' }
}

export async function updateOnboardingDepotAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing depot id.' }
  const result = await updateDepot(id, {
    name: formData.get('name'),
    address: formData.get('address'),
    sortOrder: formData.get('sortOrder'),
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin()
  return { ok: true, message: 'Depot saved.' }
}

export async function deleteOnboardingDepotAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing depot id.' }
  const result = await deleteDepot(id)
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin()
  return { ok: true, message: 'Depot deleted.' }
}

export async function createOnboardingTagAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const result = await createTag({
    label: formData.get('label'),
    color: formData.get('color'),
    todo: formData.get('todo'),
    fade: formData.get('fade'),
    sortOrder: formData.get('sortOrder'),
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin()
  return { ok: true, message: 'Tag created.' }
}

export async function updateOnboardingTagAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing tag id.' }
  const result = await updateTag(id, {
    label: formData.get('label'),
    color: formData.get('color'),
    todo: formData.get('todo'),
    fade: formData.get('fade'),
    sortOrder: formData.get('sortOrder'),
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin()
  return { ok: true, message: 'Tag saved.' }
}

export async function deleteOnboardingTagAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing tag id.' }
  const result = await deleteTag(id)
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin()
  return { ok: true, message: 'Tag deleted.' }
}

export async function updateOnboardingPersonStatusAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const userId = String(formData.get('userId') ?? '').trim()
  const statusId = String(formData.get('statusId') ?? '').trim()
  if (!userId) return { error: 'Missing person id.' }
  if (!statusId) return { error: 'Status is required.' }

  const result = await writeIdentityFacts(userId, { statusId })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin(userId)
  return { ok: true, message: 'Status updated.' }
}

export async function deleteOnboardingStatusAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing status id.' }
  const result = await deleteStatus(id)
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin()
  return { ok: true, message: 'Status deleted.' }
}

export async function reorderOnboardingStatusesAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const orderedIds = String(formData.get('orderedIds') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  const result = await reorderStatuses(orderedIds)
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin()
  return { ok: true, message: 'Status order saved.' }
}

export async function inviteOnboardingPersonAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const settings = await getSiteSettings()
  const enabled = isCatalogModuleEnabled(settings, MODULE_IDS.onboarding)

  const door = await invitePersonWithRuntime(
    {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
    },
    { isEnabled: enabled, senderUserId: gate.session.user.id },
  )

  if (!door.ok) {
    return { error: 'Onboarding is disabled. Enable it under Settings → Modules.' }
  }
  if (!door.value.ok) return { error: door.value.error }

  revalidateOnboardingAdmin(door.value.userId)
  return {
    ok: true,
    message: `Invited ${door.value.name} — placed in recruiting.`,
    userId: door.value.userId,
  }
}

export async function createOnboardingEventAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const userId = String(formData.get('userId') ?? '').trim()
  if (!userId) return { error: 'Missing person id.' }

  const result = await createEvent(userId, {
    kind: formData.get('kind'),
    location: formData.get('location'),
    address: formData.get('address'),
    eventDate: formData.get('eventDate'),
    eventTime: formData.get('eventTime'),
    courierName: formData.get('courierName'),
    courierPhone: formData.get('courierPhone'),
    meetingMode: formData.get('meetingMode'),
    examUrl: formData.get('examUrl'),
    applicantResponse: formData.get('applicantResponse'),
    alsoTrial: formData.get('alsoTrial') === '1',
    requestedDates: formData.get('requestedDates'),
    requestedSubmissionId: formData.get('requestedSubmissionId'),
    dueNotice: formData.get('dueNotice') === '1',
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin(userId)
  return { ok: true, message: 'Event created.' }
}

export async function updateOnboardingEventAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const eventId = String(formData.get('eventId') ?? '').trim()
  const userId = String(formData.get('userId') ?? '').trim()
  if (!eventId) return { error: 'Missing event id.' }

  const result = await updateEvent(eventId, {
    kind: formData.get('kind'),
    location: formData.get('location'),
    address: formData.get('address'),
    eventDate: formData.get('eventDate'),
    eventTime: formData.get('eventTime'),
    courierName: formData.get('courierName'),
    courierPhone: formData.get('courierPhone'),
    meetingMode: formData.get('meetingMode'),
    examUrl: formData.get('examUrl'),
    applicantResponse: formData.get('applicantResponse'),
    alsoTrial: formData.get('alsoTrial') === '1',
    requestedDates: formData.get('requestedDates'),
    requestedSubmissionId: formData.get('requestedSubmissionId'),
    dueNotice: formData.get('dueNotice') === '1',
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin(userId || result.event.userId)
  return { ok: true, message: 'Event saved.' }
}

export async function setOnboardingEventOutcomeAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const eventId = String(formData.get('eventId') ?? '').trim()
  const outcome = String(formData.get('outcome') ?? '').trim()
  if (!eventId) return { error: 'Missing event id.' }

  const result = await setEventOutcome(eventId, outcome, gate.session.user.id)
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin(result.event.userId)
  return { ok: true, message: `Outcome set to ${result.event.outcome}.` }
}

export async function createOnboardingNoteAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const userId = String(formData.get('userId') ?? '').trim()
  const result = await createNote({
    userId,
    body: String(formData.get('body') ?? ''),
    authorUserId: gate.session.user.id,
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin(userId)
  return { ok: true, message: 'Note added.' }
}

export async function saveOnboardingFollowUpAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const userId = String(formData.get('userId') ?? '').trim()
  const tagIds = formData
    .getAll('tagIds')
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
  const result = await upsertFollowUp({
    id: String(formData.get('id') ?? ''),
    userId,
    tags: tagIds,
    note: String(formData.get('note') ?? ''),
    reminderStatus: String(formData.get('reminderStatus') ?? 'open'),
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin(userId)
  return { ok: true, message: 'Follow-up saved.' }
}

export async function createOnboardingCallAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const userId = String(formData.get('userId') ?? '').trim()
  const result = await createCall({
    userId,
    callAt: String(formData.get('callAt') ?? ''),
    done: formData.get('done') === '1',
    dueNotice: formData.get('dueNotice') === '1',
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin(userId)
  return { ok: true, message: 'Call logged.' }
}

export async function updateOnboardingCallAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const callId = String(formData.get('callId') ?? '').trim()
  const userId = String(formData.get('userId') ?? '').trim()
  if (!callId) return { error: 'Missing call id.' }

  const result = await updateCall(callId, {
    done: formData.get('done') === '1',
    dueNotice: formData.get('dueNotice') === '1',
    callAt: formData.has('callAt') ? String(formData.get('callAt') ?? '') : undefined,
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin(userId)
  return { ok: true, message: 'Call updated.' }
}

export async function seedOnboardingEmailStartersAction(
  _prev: OnboardingAdminActionState,
  _formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const result = await seedOnboardingEmailStarters()
  if (!result.ok) return { error: result.error || 'Could not seed email starters.' }
  revalidateOnboardingAdmin()
  return { ok: true, message: result.message }
}

export async function saveOnboardingTrainingReportAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const result = await saveTrainingReport({
    id: formData.get('id'),
    traineeUserId: formData.get('traineeUserId'),
    instructorUserId: formData.get('instructorUserId'),
    reportDate: formData.get('reportDate'),
    depotKey: formData.get('depotKey'),
    depotLabel: formData.get('depotLabel'),
    trainingDay: formData.get('trainingDay'),
    plate: formData.get('plate'),
    rounds: formData.get('rounds'),
    drove: formData.get('drove') === '1',
    status: formData.get('status'),
    passed: formData.get('passed'),
    note: formData.get('note'),
    checklist: parseChecklistFromForm(formData),
    actorUserId: gate.session.user.id,
  })
  if (!result.ok) return { error: result.error }

  const qualNote = result.qualificationCreated
    ? ' Qualification date recorded.'
    : result.report.passed === 'yes'
      ? ' Qualification already on file.'
      : ''
  revalidateOnboardingAdmin(result.report.traineeUserId)
  return {
    ok: true,
    message: `Training report saved.${qualNote} Status unchanged.`,
    userId: result.report.traineeUserId,
  }
}

export async function recordOnboardingQuizAttemptAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const result = await recordQuizAttempt({
    userId: formData.get('userId'),
    formDefinitionId: formData.get('formDefinitionId'),
    attemptId: formData.get('attemptId'),
    passed: formData.get('passed') === '1',
    resultNote: formData.get('resultNote'),
  })
  if (!result.ok) return { error: result.error }

  const qualNote = result.qualificationCreated
    ? ' Qualification date recorded.'
    : result.attempt.passed
      ? ' Qualification already on file.'
      : ' No qualification (fail).'
  revalidateOnboardingAdmin(result.attempt.userId)
  return {
    ok: true,
    message: `Quiz attempt recorded.${qualNote} Status unchanged.`,
    userId: result.attempt.userId,
  }
}

export async function saveOnboardingTrainerAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const result = await upsertTrainer({
    id: formData.get('id'),
    name: formData.get('name'),
    phone: formData.get('phone'),
    linkedUserId: formData.get('linkedUserId'),
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin()
  return { ok: true, message: 'Trainer saved.' }
}

export async function createOnboardingTrainerSlotAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const result = await createTrainerSlot({
    instructorUserId: formData.get('instructorUserId'),
    slotDate: formData.get('slotDate'),
    slotIndex: formData.get('slotIndex'),
    startTime: formData.get('startTime'),
    locationCode: formData.get('locationCode'),
    traineeUserId: formData.get('traineeUserId'),
    kind: formData.get('kind'),
    status: formData.get('status'),
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin(result.slot.traineeUserId || undefined)
  return { ok: true, message: 'Trainer slot created.' }
}

export async function updateOnboardingTrainerSlotAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!slotId) return { error: 'Missing trainer slot id.' }

  const result = await updateTrainerSlot(slotId, {
    instructorUserId: formData.get('instructorUserId'),
    slotDate: formData.get('slotDate'),
    slotIndex: formData.get('slotIndex'),
    startTime: formData.get('startTime'),
    locationCode: formData.get('locationCode'),
    traineeUserId: formData.get('traineeUserId'),
    kind: formData.get('kind'),
    status: formData.get('status'),
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin(result.slot.traineeUserId || undefined)
  return { ok: true, message: 'Trainer slot saved.' }
}

export async function saveOnboardingValidUntilAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const gate = await requireOnboardingAdmin()
  if (gate.denied) return gate.denied

  const userId = String(formData.get('userId') ?? '').trim()
  if (!userId) return { error: 'Missing user id.' }

  const result = await savePersonValidUntilDates({
    userId,
    drivingLicenceValidUntil: formData.get('drivingLicenceValidUntil'),
    healthBookletValidUntil: formData.get('healthBookletValidUntil'),
    contractValidUntil: formData.get('contractValidUntil'),
    drivingLicenceMediaId: formData.get('drivingLicenceMediaId'),
    healthBookletMediaId: formData.get('healthBookletMediaId'),
    contractMediaId: formData.get('contractMediaId'),
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin(userId)
  return { ok: true, message: 'Valid-until dates saved.', userId }
}

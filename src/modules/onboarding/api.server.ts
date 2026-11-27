/**
 * product:onboarding server door.
 *
 *   import {
 *     ONBOARDING_MODULE_ID,
 *     runOnboardingDoor,
 *     listOnboardingStatuses,
 *     getOnboardingIdentityFacts,
 *     writeOnboardingIdentityFacts,
 *     isOnboardingUserBookable,
 *     listOnboardingStations,
 *     inviteOnboardingPersonDoor,
 *   } from '@/modules/onboarding/api.server'
 *
 * When Onboarding is off, door helpers return `{ ok: false, reason: 'disabled' }`
 * and never run the work. No Core fact-map port.
 */

import 'server-only'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { runOnboardingDoor, type OnboardingDoorResult } from './door'
import {
  ensureOnboardingEmailStartersSeeded,
  seedOnboardingEmailStarters,
} from './email-starters'
import { invitePersonWithRuntime } from './invite-runtime'
import type { InviteResult } from './invite'
import type { InviteFieldInput } from './procedure-rules'
import {
  createEvent,
  getPersonCard,
  listEventsForUser,
  listMailLogsForUser,
  listWorkers,
  recordMailLog,
  setEventOutcome,
} from './procedure-store'
import {
  loadOnboardingModuleSettings,
  saveOnboardingModuleSettings,
} from './settings'
import {
  ensureSeededStatuses,
  getIdentityFacts,
  isUserBookable,
  listStations,
  listStatuses,
  writeIdentityFacts,
} from './store'
import type { IdentityFieldInput } from './status-rules'
import {
  getLatestTrainingResult,
  listQualifications,
  listTrainingReports,
  recordQuizAttempt,
  saveTrainingReport,
} from './training-store'
import type {
  OnboardingDocumentSlotRecord,
  OnboardingEventRecord,
  OnboardingIdentityFacts,
  OnboardingMailLogRecord,
  OnboardingModuleSettings,
  OnboardingQualificationRecord,
  OnboardingStationRecord,
  OnboardingStatusRecord,
  OnboardingTrainingReportRecord,
  OnboardingWorkerRow,
} from './types'
import type { PersonValidUntilInput } from './valid-until-rules'
import {
  listDocumentSlotsForUser,
  savePersonValidUntilDates,
} from './valid-until-store'

export { ONBOARDING_MODULE_ID } from './ids'
export { runOnboardingDoor } from './door'
export type { OnboardingDoorResult } from './door'
export type {
  OnboardingDocumentSlotRecord,
  OnboardingEventRecord,
  OnboardingIdentityFacts,
  OnboardingMailLogRecord,
  OnboardingModuleSettings,
  OnboardingQualificationRecord,
  OnboardingStationRecord,
  OnboardingStatusRecord,
  OnboardingTrainingReportRecord,
  OnboardingWorkerRow,
} from './types'
export type { InviteResult } from './invite'

async function onboardingEnabled(): Promise<boolean> {
  const settings = await getSiteSettings()
  return isCatalogModuleEnabled(settings, MODULE_IDS.onboarding)
}

/** List statuses (including attached Forms definition id). Seeds defaults when empty. */
export async function listOnboardingStatuses(): Promise<
  OnboardingDoorResult<OnboardingStatusRecord[]>
> {
  return runOnboardingDoor(onboardingEnabled, async () => {
    await ensureSeededStatuses()
    return listStatuses()
  })
}

/** Read identity facts for a Core user id. Phone falls back to Profiles when the fact is missing. */
export async function getOnboardingIdentityFacts(
  userId: string,
): Promise<OnboardingDoorResult<OnboardingIdentityFacts | null>> {
  return runOnboardingDoor(onboardingEnabled, () => getIdentityFacts(userId))
}

/** Write identity facts for a Core user id. Does not copy name or email. */
export async function writeOnboardingIdentityFacts(
  userId: string,
  input: IdentityFieldInput,
): Promise<
  OnboardingDoorResult<
    { ok: true; facts: OnboardingIdentityFacts } | { ok: false; error: string }
  >
> {
  return runOnboardingDoor(onboardingEnabled, () => writeIdentityFacts(userId, input))
}

/**
 * Bookable for a user id given a Fleet vehicle-access flag.
 * Status flag on, or vehicle access → true. Neither → false.
 */
export async function isOnboardingUserBookable(
  userId: string,
  hasVehicleAccess: boolean,
): Promise<OnboardingDoorResult<boolean>> {
  return runOnboardingDoor(onboardingEnabled, () => isUserBookable(userId, hasVehicleAccess))
}

/**
 * Station / depot catalog for pickers.
 * While Fleet is absent, returns the Onboarding depot list. Empty when no depots exist.
 * Onboarding still stores a station id on identity facts.
 */
export async function listOnboardingStations(): Promise<
  OnboardingDoorResult<OnboardingStationRecord[]>
> {
  return runOnboardingDoor(onboardingEnabled, () => listStations())
}

/** Workers table rows (identity + Core name/email). */
export async function listOnboardingWorkers(filter?: {
  statusId?: string
}): Promise<OnboardingDoorResult<OnboardingWorkerRow[]>> {
  return runOnboardingDoor(onboardingEnabled, () => listWorkers(filter))
}

/** Procedure events for a person. */
export async function listOnboardingEventsForUser(
  userId: string,
): Promise<OnboardingDoorResult<OnboardingEventRecord[]>> {
  return runOnboardingDoor(onboardingEnabled, () => listEventsForUser(userId))
}

/** Person card bundle for admin. */
export async function getOnboardingPersonCard(
  userId: string,
): Promise<OnboardingDoorResult<Awaited<ReturnType<typeof getPersonCard>>>> {
  return runOnboardingDoor(onboardingEnabled, () => getPersonCard(userId))
}

/**
 * Invite: create Core user, place in recruiting, emit set-password + application mail.
 * Off → disabled, no user created.
 */
export async function inviteOnboardingPersonDoor(
  input: InviteFieldInput,
  opts?: { senderUserId?: string },
): Promise<OnboardingDoorResult<InviteResult>> {
  return invitePersonWithRuntime(input, {
    isEnabled: onboardingEnabled,
    senderUserId: opts?.senderUserId,
  })
}

/** Set event outcome only — never advances main status. */
export async function setOnboardingEventOutcomeDoor(
  eventId: string,
  outcome: string,
  actorUserId: string,
): Promise<
  OnboardingDoorResult<Awaited<ReturnType<typeof setEventOutcome>>>
> {
  return runOnboardingDoor(onboardingEnabled, () =>
    setEventOutcome(eventId, outcome, actorUserId),
  )
}

export async function createOnboardingEventDoor(
  userId: string,
  input: Parameters<typeof createEvent>[1],
): Promise<OnboardingDoorResult<Awaited<ReturnType<typeof createEvent>>>> {
  return runOnboardingDoor(onboardingEnabled, () => createEvent(userId, input))
}

export async function listOnboardingMailLogsForUser(
  userId: string,
): Promise<OnboardingDoorResult<OnboardingMailLogRecord[]>> {
  return runOnboardingDoor(onboardingEnabled, () => listMailLogsForUser(userId))
}

export async function recordOnboardingMailLogDoor(
  input: Parameters<typeof recordMailLog>[0],
): Promise<OnboardingDoorResult<Awaited<ReturnType<typeof recordMailLog>>>> {
  return runOnboardingDoor(onboardingEnabled, () => recordMailLog(input))
}

export async function ensureOnboardingEmailStartersDoor(): Promise<
  OnboardingDoorResult<Awaited<ReturnType<typeof ensureOnboardingEmailStartersSeeded>>>
> {
  return runOnboardingDoor(onboardingEnabled, () => ensureOnboardingEmailStartersSeeded())
}

export async function seedOnboardingEmailStartersDoor(): Promise<
  OnboardingDoorResult<Awaited<ReturnType<typeof seedOnboardingEmailStarters>>>
> {
  return runOnboardingDoor(onboardingEnabled, () => seedOnboardingEmailStarters())
}

/** Latest training report / qualification / quiz attempt for a person. */
export async function getOnboardingLatestTrainingResult(
  userId: string,
): Promise<OnboardingDoorResult<Awaited<ReturnType<typeof getLatestTrainingResult>>>> {
  return runOnboardingDoor(onboardingEnabled, () => getLatestTrainingResult(userId))
}

export async function listOnboardingTrainingReports(filter?: {
  traineeUserId?: string
}): Promise<OnboardingDoorResult<OnboardingTrainingReportRecord[]>> {
  return runOnboardingDoor(onboardingEnabled, () => listTrainingReports(filter))
}

export async function listOnboardingQualifications(filter?: {
  userId?: string
}): Promise<OnboardingDoorResult<OnboardingQualificationRecord[]>> {
  return runOnboardingDoor(onboardingEnabled, () => listQualifications(filter))
}

export async function saveOnboardingTrainingReportDoor(
  input: Parameters<typeof saveTrainingReport>[0],
): Promise<OnboardingDoorResult<Awaited<ReturnType<typeof saveTrainingReport>>>> {
  return runOnboardingDoor(onboardingEnabled, () => saveTrainingReport(input))
}

export async function recordOnboardingQuizAttemptDoor(
  input: Parameters<typeof recordQuizAttempt>[0],
): Promise<OnboardingDoorResult<Awaited<ReturnType<typeof recordQuizAttempt>>>> {
  return runOnboardingDoor(onboardingEnabled, () => recordQuizAttempt(input))
}

/** Document slots + valid-until dates for a person. */
export async function listOnboardingDocumentSlots(
  userId: string,
): Promise<OnboardingDoorResult<OnboardingDocumentSlotRecord[]>> {
  return runOnboardingDoor(onboardingEnabled, () => listDocumentSlotsForUser(userId))
}

/** Save valid-until dates on licence / health booklet / contract. Empty = missing. */
export async function saveOnboardingValidUntilDoor(
  input: PersonValidUntilInput,
): Promise<OnboardingDoorResult<Awaited<ReturnType<typeof savePersonValidUntilDates>>>> {
  return runOnboardingDoor(onboardingEnabled, () => savePersonValidUntilDates(input))
}

/** Load Onboarding settings (invite template id). Event types live on the catalog. */
export async function loadOnboardingSettingsDoor(): Promise<
  OnboardingDoorResult<OnboardingModuleSettings>
> {
  return runOnboardingDoor(onboardingEnabled, async () => {
    const loaded = await loadOnboardingModuleSettings()
    return loaded.settings
  })
}

/** Save the invite template id. Empty clears; unknown ids are refused. */
export async function saveOnboardingSettingsDoor(
  input: Parameters<typeof saveOnboardingModuleSettings>[0],
): Promise<OnboardingDoorResult<Awaited<ReturnType<typeof saveOnboardingModuleSettings>>>> {
  return runOnboardingDoor(onboardingEnabled, () => saveOnboardingModuleSettings(input))
}

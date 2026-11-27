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
 *   } from '@/modules/onboarding/api.server'
 *
 * When Onboarding is off, door helpers return `{ ok: false, reason: 'disabled' }`
 * and never run the work. No Core fact-map port.
 */

import 'server-only'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { runOnboardingDoor, type OnboardingDoorResult } from './door'
import {
  ensureSeededStatuses,
  getIdentityFacts,
  isUserBookable,
  listStations,
  listStatuses,
  writeIdentityFacts,
} from './store'
import type { IdentityFieldInput } from './status-rules'
import type {
  OnboardingIdentityFacts,
  OnboardingStationRecord,
  OnboardingStatusRecord,
} from './types'

export { ONBOARDING_MODULE_ID } from './ids'
export { runOnboardingDoor } from './door'
export type { OnboardingDoorResult } from './door'
export type {
  OnboardingIdentityFacts,
  OnboardingStationRecord,
  OnboardingStatusRecord,
} from './types'

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
 * Station catalog for pickers. Empty while Fleet is absent from the tree.
 * Onboarding still stores a station id on identity facts.
 */
export async function listOnboardingStations(): Promise<
  OnboardingDoorResult<OnboardingStationRecord[]>
> {
  return runOnboardingDoor(onboardingEnabled, () => listStations())
}

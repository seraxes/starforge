/**
 * product:onboarding public door (client-safe surface).
 *
 *   import { ONBOARDING_MODULE_ID, runOnboardingDoor } from '@/modules/onboarding/api'
 *
 * Server reads / writes (statuses, identity facts, bookable, stations) stay on
 * `@/modules/onboarding/api.server`.
 */

export { ONBOARDING_MODULE_ID } from './ids'
export { runOnboardingDoor } from './door'
export type { OnboardingDoorResult } from './door'
export type {
  OnboardingIdentityFacts,
  OnboardingStationRecord,
  OnboardingStatusRecord,
} from './types'

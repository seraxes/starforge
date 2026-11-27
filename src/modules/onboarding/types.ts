/** product:onboarding domain records (slice 2). */

export type OnboardingStatusRecord = {
  id: string
  key: string
  name: string
  bookable: boolean
  /** Forms definition id, or empty when the status has no intake. */
  formDefinitionId: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export type OnboardingIdentityFacts = {
  userId: string
  statusId: string
  /** Blank when unset. */
  driverCode: string
  /**
   * Resolved phone for display: onboarding fact when present,
   * otherwise Profiles fallback (never copies name/email).
   */
  phone: string
  /** Raw onboarding phone fact (empty when missing). */
  phoneFact: string
  stationId: string
  homeRunAllow: boolean
  homeRunFreeKm: number
  trainer: boolean
  clearquote: string
  createdAt: Date | null
  updatedAt: Date | null
}

/** Fleet station catalog row. Empty list while Fleet is absent. */
export type OnboardingStationRecord = {
  id: string
  label: string
}

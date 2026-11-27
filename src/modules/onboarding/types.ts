/** product:onboarding domain records (slice 11 staff tags + earlier). */

import type { OnboardingEmailEventType } from './email-binding-rules'
import type { OnboardingEventTypeSettings } from './event-type-settings-rules'
import type {
  OnboardingEventKind,
  OnboardingMailChannel,
  OnboardingMeetingMode,
} from './procedure-rules'
import type { OnboardingStatusPhase } from './status-rules'
import type {
  TrainerSlotKind,
  TrainerSlotStatus,
  TrainingChecklistSection,
  TrainingPassedValue,
  TrainingQualificationSource,
  TrainingReportStatus,
} from './training-rules'
import type { OnboardingDocumentKind } from './valid-until-rules'

export type { OnboardingEventTypeSettings }

export type OnboardingStatusRecord = {
  id: string
  key: string
  name: string
  phase: OnboardingStatusPhase
  /** Label shown on the driver / people list. */
  displayLabel: string
  actionChip: string
  nextStepMessage: string
  /** True when phase is active (or legacy flag). */
  bookable: boolean
  /** Forms definition id, or empty when the status has no intake. */
  formDefinitionId: string
  /**
   * Email Manager reminder template id. Recruiting only; empty = unbound.
   * Subject/body stay in Email Manager.
   */
  reminderTemplateId: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

/** Module settings document in `sf_module_settings` (id = product:onboarding). */
export type OnboardingModuleSettings = {
  /** New-driver invite Email Manager template id. Empty = unbound. */
  inviteTemplateId: string
  /** Confirmation template id per event type. Empty = unbound. */
  eventTemplateIds: Record<OnboardingEmailEventType, string>
  /**
   * Per event type: Forms definition id, date field name(s), active / completed status ids.
   * Template ids stay in `eventTemplateIds`. Subject/body stay in Email Manager.
   */
  eventTypeSettings: Record<OnboardingEmailEventType, OnboardingEventTypeSettings>
}

function defaultEventTypeSettings(): OnboardingEventTypeSettings {
  return {
    formDefinitionId: '',
    dateFieldNames: [],
    activeStatusIds: [],
    completedStatusIds: [],
  }
}

export const DEFAULT_ONBOARDING_MODULE_SETTINGS: OnboardingModuleSettings = {
  inviteTemplateId: '',
  eventTemplateIds: {
    ridealong: '',
    testday: '',
    trialday: '',
  },
  eventTypeSettings: {
    ridealong: defaultEventTypeSettings(),
    testday: defaultEventTypeSettings(),
    trialday: defaultEventTypeSettings(),
  },
}

/** Depot row — catalog while Fleet is absent. */
export type OnboardingDepotRecord = {
  id: string
  name: string
  address: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

/**
 * Staff tag catalog row. Marks a person; does not move status.
 * Follow-up.tags stores these ids (not free-text labels).
 */
export type OnboardingTagRecord = {
  id: string
  label: string
  color: string
  todo: boolean
  fade: boolean
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

export type OnboardingEventRecord = {
  id: string
  userId: string
  kind: OnboardingEventKind
  location: string
  address: string
  eventDate: string
  eventTime: string
  courierName: string
  courierPhone: string
  meetingMode: OnboardingMeetingMode
  examUrl: string
  applicantResponse: string
  outcome: string
  outcomeActorUserId: string
  outcomeAt: Date | null
  alsoTrial: boolean
  requestedDates: string[]
  requestedSubmissionId: string
  dueNotice: boolean
  createdAt: Date
  updatedAt: Date
}

export type OnboardingNoteRecord = {
  id: string
  userId: string
  body: string
  authorUserId: string
  createdAt: Date
}

export type OnboardingFollowUpRecord = {
  id: string
  userId: string
  /** Catalog tag ids from sf_onboarding_tags. */
  tags: string[]
  note: string
  reminderStatus: string
  reminderSentAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type OnboardingCallRecord = {
  id: string
  userId: string
  callAt: Date | null
  done: boolean
  dueNotice: boolean
  createdAt: Date
  updatedAt: Date
}

export type OnboardingMailLogRecord = {
  id: string
  userId: string
  channel: OnboardingMailChannel
  subject: string
  body: string
  toEmail: string
  sentAt: Date
  senderUserId: string
  createdAt: Date
}

/** Workers table row — Core user + identity + procedure counts. */
export type OnboardingWorkerRow = {
  userId: string
  name: string
  email: string
  statusId: string
  statusKey: string
  /** Display label for the people table (falls back to status name). */
  statusName: string
  phone: string
  driverCode: string
  eventCount: number
  noteCount: number
  updatedAt: Date | null
}

export type OnboardingTrainingReportRecord = {
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
  createdAt: Date
  updatedAt: Date
}

export type OnboardingTrainingSaveLogRecord = {
  id: string
  reportId: string
  actorUserId: string
  action: 'save'
  createdAt: Date
}

export type OnboardingQualificationRecord = {
  id: string
  userId: string
  source: TrainingQualificationSource
  qualifiedDate: string
  createdAt: Date
}

export type OnboardingQuizAttemptRecord = {
  id: string
  userId: string
  formDefinitionId: string
  attemptId: string
  passed: boolean
  resultNote: string
  createdAt: Date
}

export type OnboardingTrainerRecord = {
  id: string
  name: string
  phone: string
  linkedUserId: string
  createdAt: Date
  updatedAt: Date
}

export type OnboardingTrainerSlotRecord = {
  id: string
  instructorUserId: string
  slotDate: string
  slotIndex: number
  startTime: string
  locationCode: string
  traineeUserId: string
  kind: TrainerSlotKind
  status: TrainerSlotStatus
  createdAt: Date
  updatedAt: Date
}

/** Document slot on the person — date only; file is a Media id. */
export type OnboardingDocumentSlotRecord = {
  id: string
  userId: string
  kind: OnboardingDocumentKind
  mediaId: string
  /** YYYY-MM-DD or empty (missing, not expired). */
  validUntil: string
  createdAt: Date
  updatedAt: Date
}

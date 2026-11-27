/**
 * product:onboarding public door (client-safe surface).
 *
 *   import { ONBOARDING_MODULE_ID, runOnboardingDoor } from '@/modules/onboarding/api'
 *
 * Server reads / writes (statuses, identity facts, procedure, invite, training) stay on
 * `@/modules/onboarding/api.server`.
 */

export { ONBOARDING_MODULE_ID } from './ids'
export { runOnboardingDoor } from './door'
export type { OnboardingDoorResult } from './door'
export {
  ONBOARDING_EVENT_KINDS,
  ONBOARDING_MAIL_CHANNELS,
  outcomesForEventKind,
  statusIdAfterEventOutcome,
} from './procedure-rules'
export type {
  OnboardingEventKind,
  OnboardingMailChannel,
  OnboardingMeetingMode,
} from './procedure-rules'
export {
  TRAINING_CHECKLIST_SECTION_COUNT,
  TRAINER_SLOT_INDEX_MAX,
  emptyTrainingChecklist,
  planQualificationOnChecklistPass,
  planQualificationOnQuizResult,
  statusIdAfterTrainingPass,
  validateTrainerSlotIndex,
  validateTrainingChecklist,
} from './training-rules'
export type {
  TrainingChecklistSection,
  TrainingPassedValue,
  TrainingQualificationSource,
  TrainingReportStatus,
} from './training-rules'
export {
  ONBOARDING_STATUS_PHASES,
  bookableFromPhase,
  isOnboardingStatusPhase,
  statusListLabel,
  statusesForCatalog,
  validateStatusFields,
} from './status-rules'
export type { OnboardingStatusPhase } from './status-rules'
export {
  ONBOARDING_EMAIL_EVENT_TYPES,
  validateEmailTemplateBinding,
  validateReminderTemplateBinding,
} from './email-binding-rules'
export type { OnboardingEmailEventType } from './email-binding-rules'
export {
  depotsAsStationCatalog,
  isEventOutcomeOpen,
  planPassedOutcomesForCompletedStatus,
  validateDepotFields,
} from './event-type-settings-rules'
export type { OnboardingEventTypeSettings } from './event-type-settings-rules'
export {
  SEEDED_ONBOARDING_EVENT_TYPES,
  eventTypesForExistingCard,
  eventTypesForNewCard,
  planDeleteEventType,
  validateEventTypeFields,
} from './event-type-catalog-rules'
export {
  SEEDED_ONBOARDING_TAGS,
  statusIdAfterTagSave,
  validateFollowUpTagIds,
  validateTagFields,
} from './tag-catalog-rules'
export {
  ONBOARDING_DOCUMENT_KINDS,
  isValidUntilExpired,
  isValidUntilMissing,
  presenceOnlyValidUntil,
  validUntilState,
} from './valid-until-rules'
export type {
  OnboardingDocumentKind,
  ValidUntilState,
} from './valid-until-rules'
export type {
  OnboardingDocumentSlotRecord,
  OnboardingEventRecord,
  OnboardingEventTypeRecord,
  OnboardingIdentityFacts,
  OnboardingMailLogRecord,
  OnboardingModuleSettings,
  OnboardingQualificationRecord,
  OnboardingStationRecord,
  OnboardingStatusRecord,
  OnboardingTagRecord,
  OnboardingTrainingReportRecord,
  OnboardingWorkerRow,
} from './types'
export { DEFAULT_ONBOARDING_MODULE_SETTINGS } from './types'

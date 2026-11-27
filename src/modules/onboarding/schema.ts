/**
 * product:onboarding tables (sf_onboarding_*).
 * Included via drizzle.config schema glob under src/modules.
 *
 * Slice 12: dashboard tiles + optional status page id for the driver-home particle.
 * Slice 11: staff tag catalog (label, color, to-do, fade). Follow-up tags store catalog ids.
 * Event-type catalog (`sf_onboarding_event_types`): key, label, enabled, template id,
 * Forms definition id, date field names, active/completed status ids. Seeds are not the only types.
 * Slice 10: depots (short name + address while Fleet is off).
 * Slice 8: email binding — reminder template id on recruiting statuses;
 * invite template id lives in module settings. Event-type template ids live on the catalog.
 * Slice 7: status phase + driver-list copy (display label, action chip, next-step message).
 * Slice 5: document slots + valid-until on licence / health booklet / contract
 * (plus slice 4 training, slice 3 procedure / notes / invite, slice 2 statuses / facts).
 * Cross-pack ids (Core user, Forms definition, Fleet station, Media, Email templates, Pages) are plain text — no FKs.
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/** Named recruiting / driver status. Staff can add more. Optional Forms definition. */
export const sfOnboardingStatuses = pgTable(
  'sf_onboarding_statuses',
  {
    id: text('id').primaryKey(),
    /** Stable key — e.g. recruiting, active, banned. Unique. */
    key: text('key').notNull(),
    name: text('name').notNull().default(''),
    /**
     * Workflow phase: recruiting | declined | inactive | active | banned.
     * Active phase is bookable (synced into `bookable`).
     */
    phase: text('phase').notNull().default('recruiting'),
    /** Label shown on the driver / people list. Empty → fall back to name. */
    displayLabel: text('display_label').notNull().default(''),
    /** Short action text for the driver home particle. */
    actionChip: text('action_chip').notNull().default(''),
    /** Next-step instruction for the driver home particle. */
    nextStepMessage: text('next_step_message').notNull().default(''),
    /**
     * Optional Pages page id for a longer explanation above the particle (plain text; no FK).
     * Pages owns the article body. Empty = no linked page.
     */
    pageId: text('page_id').notNull().default(''),
    /** When true, the person is bookable without Fleet vehicle access. Synced from phase === active. */
    bookable: boolean('bookable').notNull().default(false),
    /** Optional Forms definition id (plain text). Empty = no intake (e.g. banned). */
    formDefinitionId: text('form_definition_id').notNull().default(''),
    /**
     * Email Manager reminder template id (plain text; no FK).
     * Only meaningful when phase is recruiting. Empty = unbound.
     */
    reminderTemplateId: text('reminder_template_id').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_onboarding_statuses_key_uidx').on(table.key),
    index('sf_onboarding_statuses_sort_idx').on(table.sortOrder),
    index('sf_onboarding_statuses_bookable_idx').on(table.bookable),
    index('sf_onboarding_statuses_phase_idx').on(table.phase),
  ],
)

/**
 * Identity facts hung on the Core user id.
 * Name and email stay on the Core user — not copied here.
 * Phone falls back to Profiles only when this phone fact is missing.
 */
export const sfOnboardingIdentityFacts = pgTable(
  'sf_onboarding_identity_facts',
  {
    /** Core user id (plain text). */
    userId: text('user_id').primaryKey(),
    /** Current status id (plain text; no FK). */
    statusId: text('status_id').notNull().default(''),
    /**
     * Driver code — unique when set, up to 6 chars.
     * Null / omitted when unset (unique index allows multiple nulls).
     */
    driverCode: text('driver_code'),
    /** Onboarding phone. Blank → Profiles fallback on read. */
    phone: text('phone').notNull().default(''),
    /** Fleet station id. Catalog comes from Fleet; this pack only stores the id. */
    stationId: text('station_id').notNull().default(''),
    homeRunAllow: boolean('home_run_allow').notNull().default(false),
    homeRunFreeKm: integer('home_run_free_km').notNull().default(0),
    trainer: boolean('trainer').notNull().default(false),
    clearquote: text('clearquote').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_onboarding_identity_driver_code_uidx').on(table.driverCode),
    index('sf_onboarding_identity_status_idx').on(table.statusId),
    index('sf_onboarding_identity_station_idx').on(table.stationId),
  ],
)

/**
 * Procedure event card hung on the Core user id.
 * Outcome is the event’s own result — it never advances the person’s main status.
 */
export const sfOnboardingEvents = pgTable(
  'sf_onboarding_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    /** Event-type catalog key (plain text; no FK). */
    kind: text('kind').notNull(),
    location: text('location').notNull().default(''),
    address: text('address').notNull().default(''),
    /** Calendar day YYYY-MM-DD when set. */
    eventDate: text('event_date').notNull().default(''),
    /** Local time HH:MM when set. */
    eventTime: text('event_time').notNull().default(''),
    courierName: text('courier_name').notNull().default(''),
    courierPhone: text('courier_phone').notNull().default(''),
    /** onsite | online */
    meetingMode: text('meeting_mode').notNull().default('onsite'),
    examUrl: text('exam_url').notNull().default(''),
    /** attending when the applicant confirmed; blank otherwise. */
    applicantResponse: text('applicant_response').notNull().default(''),
    outcome: text('outcome').notNull().default(''),
    outcomeActorUserId: text('outcome_actor_user_id').notNull().default(''),
    outcomeAt: timestamp('outcome_at', { withTimezone: true }),
    alsoTrial: boolean('also_trial').notNull().default(false),
    requestedDates: jsonb('requested_dates').$type<string[]>().notNull().default([]),
    requestedSubmissionId: text('requested_submission_id').notNull().default(''),
    dueNotice: boolean('due_notice').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_onboarding_events_user_idx').on(table.userId),
    index('sf_onboarding_events_kind_idx').on(table.kind),
    index('sf_onboarding_events_date_idx').on(table.eventDate),
    index('sf_onboarding_events_outcome_idx').on(table.outcome),
  ],
)

/** Timestamped staff note on a person. */
export const sfOnboardingNotes = pgTable(
  'sf_onboarding_notes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    body: text('body').notNull().default(''),
    authorUserId: text('author_user_id').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sf_onboarding_notes_user_idx').on(table.userId),
    index('sf_onboarding_notes_created_idx').on(table.createdAt),
  ],
)

/**
 * Staff follow-up mark (catalog tag ids + short note + reminder).
 * Tags are staff marks only — they never move the person’s status.
 */
export const sfOnboardingFollowUps = pgTable(
  'sf_onboarding_follow_ups',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    /** Catalog tag ids from sf_onboarding_tags (plain text; no FK). */
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    note: text('note').notNull().default(''),
    /** open | sent | done — reminder lifecycle. */
    reminderStatus: text('reminder_status').notNull().default('open'),
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_onboarding_follow_ups_user_idx').on(table.userId),
    index('sf_onboarding_follow_ups_reminder_idx').on(table.reminderStatus),
  ],
)

/**
 * Staff tag catalog. A tag marks a person; it does not move status.
 * Seeds (Waiting / On hold / Action required / No response) are examples — not a fixed set.
 */
export const sfOnboardingTags = pgTable(
  'sf_onboarding_tags',
  {
    id: text('id').primaryKey(),
    /** Display label. Empty refused on write. */
    label: text('label').notNull().default(''),
    /** CSS color (hex or named). */
    color: text('color').notNull().default(''),
    /** Highlight as a to-do mark on the person. */
    todo: boolean('todo').notNull().default(false),
    /** Soft / faded display hint. */
    fade: boolean('fade').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_onboarding_tags_sort_idx').on(table.sortOrder),
    index('sf_onboarding_tags_label_idx').on(table.label),
  ],
)

/** Scheduled / logged call on a person. */
export const sfOnboardingCalls = pgTable(
  'sf_onboarding_calls',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    callAt: timestamp('call_at', { withTimezone: true }),
    done: boolean('done').notNull().default(false),
    dueNotice: boolean('due_notice').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_onboarding_calls_user_idx').on(table.userId),
    index('sf_onboarding_calls_call_at_idx').on(table.callAt),
  ],
)

/**
 * Sent-mail log for the person card.
 * Channels: account_invite | status_reminder | event_ridealong | event_trialday | event_testday
 */
export const sfOnboardingMailLogs = pgTable(
  'sf_onboarding_mail_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    channel: text('channel').notNull(),
    subject: text('subject').notNull().default(''),
    body: text('body').notNull().default(''),
    toEmail: text('to_email').notNull().default(''),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
    senderUserId: text('sender_user_id').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sf_onboarding_mail_logs_user_idx').on(table.userId),
    index('sf_onboarding_mail_logs_channel_idx').on(table.channel),
    index('sf_onboarding_mail_logs_sent_idx').on(table.sentAt),
  ],
)

/**
 * Practical training report.
 * Checklist JSON must be exactly 14 sections (shown / practiced / independent + note).
 * A pass creates a dated qualification and never moves identity status.
 */
export const sfOnboardingTrainingReports = pgTable(
  'sf_onboarding_training_reports',
  {
    id: text('id').primaryKey(),
    traineeUserId: text('trainee_user_id').notNull(),
    instructorUserId: text('instructor_user_id').notNull().default(''),
    /** Calendar day YYYY-MM-DD. */
    reportDate: text('report_date').notNull().default(''),
    depotKey: text('depot_key').notNull().default(''),
    depotLabel: text('depot_label').notNull().default(''),
    trainingDay: text('training_day').notNull().default(''),
    plate: text('plate').notNull().default(''),
    rounds: integer('rounds').notNull().default(0),
    drove: boolean('drove').notNull().default(false),
    /** open | closed */
    status: text('status').notNull().default('open'),
    /** yes | no | partial | empty string */
    passed: text('passed').notNull().default(''),
    note: text('note').notNull().default(''),
    checklist: jsonb('checklist').$type<unknown>().notNull().default([]),
    /** Media id for the pack-local PDF (plain text; no FK). */
    mediaId: text('media_id').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_onboarding_training_reports_trainee_idx').on(table.traineeUserId),
    index('sf_onboarding_training_reports_instructor_idx').on(table.instructorUserId),
    index('sf_onboarding_training_reports_date_idx').on(table.reportDate),
    index('sf_onboarding_training_reports_status_idx').on(table.status),
    index('sf_onboarding_training_reports_passed_idx').on(table.passed),
  ],
)

/** Save log for a training report. Action is always `save` in this slice. */
export const sfOnboardingTrainingSaveLogs = pgTable(
  'sf_onboarding_training_save_logs',
  {
    id: text('id').primaryKey(),
    reportId: text('report_id').notNull(),
    actorUserId: text('actor_user_id').notNull().default(''),
    /** save */
    action: text('action').notNull().default('save'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sf_onboarding_training_save_logs_report_idx').on(table.reportId),
    index('sf_onboarding_training_save_logs_actor_idx').on(table.actorUserId),
    index('sf_onboarding_training_save_logs_created_idx').on(table.createdAt),
  ],
)

/**
 * Dated qualification earned on checklist or quiz pass.
 * Unique per person + source — a second pass does not insert another row.
 * Never changes identity status.
 */
export const sfOnboardingQualifications = pgTable(
  'sf_onboarding_qualifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    /** checklist | quiz */
    source: text('source').notNull(),
    /** Calendar day YYYY-MM-DD. */
    qualifiedDate: text('qualified_date').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('sf_onboarding_qualifications_user_source_uidx').on(table.userId, table.source),
    index('sf_onboarding_qualifications_user_idx').on(table.userId),
    index('sf_onboarding_qualifications_source_idx').on(table.source),
  ],
)

/**
 * Forms quiz attempt result. Questions stay in Forms.
 * This pack stores the attempt id and pass/fail only.
 */
export const sfOnboardingQuizAttempts = pgTable(
  'sf_onboarding_quiz_attempts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    formDefinitionId: text('form_definition_id').notNull().default(''),
    /** Forms attempt / submission id (plain text). */
    attemptId: text('attempt_id').notNull().default(''),
    passed: boolean('passed').notNull().default(false),
    resultNote: text('result_note').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sf_onboarding_quiz_attempts_user_idx').on(table.userId),
    index('sf_onboarding_quiz_attempts_form_idx').on(table.formDefinitionId),
    index('sf_onboarding_quiz_attempts_attempt_idx').on(table.attemptId),
  ],
)

/** Trainer person — display name/phone plus optional linked Core user id. */
export const sfOnboardingTrainers = pgTable(
  'sf_onboarding_trainers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().default(''),
    phone: text('phone').notNull().default(''),
    /** Linked Core user id (plain text). */
    linkedUserId: text('linked_user_id').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_onboarding_trainers_linked_idx').on(table.linkedUserId),
    index('sf_onboarding_trainers_name_idx').on(table.name),
  ],
)

/**
 * Trainer calendar slot. Slot index max 3 (1–3). Index 4 is refused.
 * Kind: ridealong | induction. Status: pending | accepted | cancelled.
 */
export const sfOnboardingTrainerSlots = pgTable(
  'sf_onboarding_trainer_slots',
  {
    id: text('id').primaryKey(),
    instructorUserId: text('instructor_user_id').notNull().default(''),
    /** Calendar day YYYY-MM-DD. */
    slotDate: text('slot_date').notNull().default(''),
    /** 1, 2, or 3. */
    slotIndex: integer('slot_index').notNull().default(1),
    startTime: text('start_time').notNull().default(''),
    locationCode: text('location_code').notNull().default(''),
    traineeUserId: text('trainee_user_id').notNull().default(''),
    /** ridealong | induction */
    kind: text('kind').notNull().default('ridealong'),
    /** pending | accepted | cancelled */
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_onboarding_trainer_slots_instructor_idx').on(table.instructorUserId),
    index('sf_onboarding_trainer_slots_date_idx').on(table.slotDate),
    index('sf_onboarding_trainer_slots_trainee_idx').on(table.traineeUserId),
    index('sf_onboarding_trainer_slots_status_idx').on(table.status),
    uniqueIndex('sf_onboarding_trainer_slots_instructor_date_index_uidx').on(
      table.instructorUserId,
      table.slotDate,
      table.slotIndex,
    ),
  ],
)

/**
 * Depot catalog used while Fleet is absent.
 * Short name + address. No Fleet import; ids are plain text on events / identity stationId.
 */
export const sfOnboardingDepots = pgTable(
  'sf_onboarding_depots',
  {
    id: text('id').primaryKey(),
    /** Short display name. Empty refused on write. */
    name: text('name').notNull().default(''),
    address: text('address').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_onboarding_depots_sort_idx').on(table.sortOrder),
    index('sf_onboarding_depots_name_idx').on(table.name),
  ],
)

/**
 * Event-type catalog. Staff add, deactivate, and delete types.
 * Person cards store `key` on `sf_onboarding_events.kind` (plain text; no FK).
 * Seeds ridealong / testday / trialday / trainingday are examples, not a fixed set.
 * Deactivate sets `enabled` false. Delete is refused while a person card uses the key.
 */
export const sfOnboardingEventTypes = pgTable(
  'sf_onboarding_event_types',
  {
    id: text('id').primaryKey(),
    /** Stable key stored on person-card events. Unique. */
    key: text('key').notNull(),
    /** Display label. Empty refused on write. */
    label: text('label').notNull().default(''),
    /** False hides the type from the new-event kind list. Existing cards keep it. */
    enabled: boolean('enabled').notNull().default(true),
    /** Email Manager confirmation template id (plain text; no FK). Empty = unbound. */
    templateId: text('template_id').notNull().default(''),
    /** Forms definition id (plain text; no FK). Empty = unbound. */
    formDefinitionId: text('form_definition_id').notNull().default(''),
    dateFieldNames: jsonb('date_field_names').$type<string[]>().notNull().default([]),
    activeStatusIds: jsonb('active_status_ids').$type<string[]>().notNull().default([]),
    completedStatusIds: jsonb('completed_status_ids').$type<string[]>().notNull().default([]),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_onboarding_event_types_key_uidx').on(table.key),
    index('sf_onboarding_event_types_sort_idx').on(table.sortOrder),
    index('sf_onboarding_event_types_enabled_idx').on(table.enabled),
  ],
)

/**
 * Driver-home dashboard tile. Visibility is filtered by published, status ids,
 * and staff-only. Empty statusIds = every person who has a status.
 * Cross-pack page/status ids are plain text — no FKs.
 */
export const sfOnboardingDashboardTiles = pgTable(
  'sf_onboarding_dashboard_tiles',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull().default(''),
    /** Icon key or short class name (display hint). */
    icon: text('icon').notNull().default(''),
    /** Destination URL (absolute or site-relative). */
    url: text('url').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    /** Unpublished tiles are hidden from the particle. */
    published: boolean('published').notNull().default(true),
    /**
     * Status ids this tile is visible for (plain text; no FK).
     * Empty list = every person who has a status.
     */
    statusIds: jsonb('status_ids').$type<string[]>().notNull().default([]),
    /** When true, only Onboarding staff (or app admin) see the tile. */
    staffOnly: boolean('staff_only').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_onboarding_dashboard_tiles_sort_idx').on(table.sortOrder),
    index('sf_onboarding_dashboard_tiles_published_idx').on(table.published),
  ],
)

/**
 * Document slot on the person for licence / health booklet / contract.
 * Answers stay in Forms. This pack stores the valid-until date only; a file is a Media id.
 * Empty valid-until = missing (not expired). Past date = expired. Presence-only import → empty date.
 */
export const sfOnboardingDocumentSlots = pgTable(
  'sf_onboarding_document_slots',
  {
    id: text('id').primaryKey(),
    /** Core user id (plain text). */
    userId: text('user_id').notNull(),
    /** driving_licence | health_booklet | contract */
    kind: text('kind').notNull(),
    /** Media id for the file (plain text; no FK). Empty when no file yet. */
    mediaId: text('media_id').notNull().default(''),
    /** Calendar day YYYY-MM-DD when set. Empty = missing (not expired). */
    validUntil: text('valid_until').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_onboarding_document_slots_user_kind_uidx').on(table.userId, table.kind),
    index('sf_onboarding_document_slots_user_idx').on(table.userId),
    index('sf_onboarding_document_slots_kind_idx').on(table.kind),
    index('sf_onboarding_document_slots_valid_until_idx').on(table.validUntil),
  ],
)

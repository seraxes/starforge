/**
 * product:forms tables (`sf_forms`, `sf_form_submissions`, `sf_form_settings`).
 * Included via the drizzle.config schema glob under src/modules.
 *
 * Postgres names and columns stay as they were when these tables lived in
 * Core. A migration that drops them destroys submissions — do not emit one.
 */

import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** Stable id for Forms module settings singleton (email defaults, etc.). */
export const FORMS_MODULE_SETTINGS_ID = 'global'

/**
 * Forms module settings (SF-65) — email defaults; transport is platform Mailer.
 * Document JSON is FormsModuleSettings.
 */
export const sfFormSettings = pgTable('sf_form_settings', {
  id: text('id').primaryKey(),
  document: text('document').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

/**
 * Form definitions (SF-65 modular Form engine).
 * Document JSON is FormDefinitionDocument (fields + JSON Schema + preset).
 */
export const sfForms = pgTable('sf_forms', {
  id: text('id').primaryKey(),
  /** Human display name (Forms admin list). */
  label: text('label').notNull().default('Untitled'),
  /** Preset id: contact | survey | event-registration | voting | ticket | blank. */
  preset: text('preset').notNull().default('blank'),
  /** Canonical FormDefinitionDocument JSON (version 1). */
  document: text('document').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

/**
 * Public Form particle submissions (SF-48 / SF-65 / SF-139).
 * `payload` is jsonb (queried later for CSV / registration). formKey identifies
 * the layout slot instance. definition_version + fields_snapshot freeze the
 * definition shape at submit time for export/audit before SF-133.
 */
export const sfFormSubmissions = pgTable(
  'sf_form_submissions',
  {
    id: text('id').primaryKey(),
    /** Stable form instance key (usually layout slot id). */
    formKey: text('form_key').notNull(),
    /** Bound Form definition id when submitted via a definition. */
    definitionId: text('definition_id'),
    /** FormDefinitionDocument.version at submit time (null for legacy inline). */
    definitionVersion: integer('definition_version'),
    /** Snapshot of field defs (or definition hash object) at submit time. */
    fieldsSnapshot: jsonb('fields_snapshot').$type<unknown>(),
    /** Signed-in Better Auth user id when available; anonymous = null. */
    userId: text('user_id'),
    layoutId: text('layout_id'),
    slotId: text('slot_id'),
    /**
     * Submitted field values as jsonb.
     * Scalars stay strings; checkbox-group / multi-file may be string arrays.
     */
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sf_form_submissions_form_key_idx').on(table.formKey),
    index('sf_form_submissions_definition_id_idx').on(table.definitionId),
    index('sf_form_submissions_created_at_idx').on(table.createdAt),
    index('sf_form_submissions_user_id_idx').on(table.userId),
  ],
)

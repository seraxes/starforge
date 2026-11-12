/**
 * product:email-manager tables (sf_email_*).
 * Included via drizzle.config schema glob under src/modules.
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

/** Shared email templates (subject + text/html + merge fields). */
export const sfEmailTemplates = pgTable(
  'sf_email_templates',
  {
    id: text('id').primaryKey(),
    label: text('label').notNull().default('Untitled template'),
    /** forms | auth | events | other — admin filter. */
    moduleCategory: text('module_category').notNull().default('other'),
    subject: text('subject').notNull().default(''),
    bodyText: text('body_text').notNull().default(''),
    bodyHtml: text('body_html'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_email_templates_module_category_idx').on(table.moduleCategory),
  ],
)

/** Automatic / conditional send rules bound to a trigger key + template. */
export const sfEmailRules = pgTable(
  'sf_email_rules',
  {
    id: text('id').primaryKey(),
    label: text('label').notNull().default('Untitled rule'),
    moduleCategory: text('module_category').notNull().default('other'),
    enabled: boolean('enabled').default(true).notNull(),
    /** e.g. product:forms/submitted */
    triggerKey: text('trigger_key').notNull(),
    /** automatic | conditional */
    mode: text('mode').notNull().default('automatic'),
    conditions: jsonb('conditions').$type<Record<string, unknown>>().notNull().default({}),
    audience: jsonb('audience').$type<Record<string, unknown>>().notNull().default({}),
    templateId: text('template_id')
      .notNull()
      .references(() => sfEmailTemplates.id, { onDelete: 'restrict' }),
    /** Optional From address override (never SMTP secrets). */
    fromOverride: text('from_override'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_email_rules_module_category_idx').on(table.moduleCategory),
    index('sf_email_rules_trigger_key_idx').on(table.triggerKey),
    index('sf_email_rules_enabled_idx').on(table.enabled),
    index('sf_email_rules_template_id_idx').on(table.templateId),
  ],
)

/**
 * Thin durable send log — written on Mailer success / fail (and skipped).
 * Dashboard `email.sent` aggregates by email_type; Email → Sends lists recent rows.
 */
export const sfEmailSends = pgTable(
  'sf_email_sends',
  {
    id: text('id').primaryKey(),
    /** sent | failed | skipped */
    status: text('status').notNull().default('failed'),
    /** transactional | marketing | system */
    emailType: text('email_type').notNull().default('transactional'),
    provider: text('provider').notNull().default('console'),
    /** Comma-joined recipients (audit; not a mailing list). */
    toAddress: text('to_address').notNull().default(''),
    subject: text('subject').notNull().default(''),
    /** Optional template / rule label for glance (+ title). */
    title: text('title'),
    error: text('error'),
    source: text('source'),
    ruleId: text('rule_id'),
    templateId: text('template_id'),
    moduleCategory: text('module_category'),
    providerMessageId: text('provider_message_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sf_email_sends_email_type_idx').on(table.emailType),
    index('sf_email_sends_status_idx').on(table.status),
    index('sf_email_sends_created_at_idx').on(table.createdAt),
    index('sf_email_sends_type_status_idx').on(table.emailType, table.status),
  ],
)

/**
 * Paced broadcast job — caller-supplied audience + template.
 * Pace (batch / gap) is copied onto the row at enqueue time.
 */
export const sfEmailBroadcasts = pgTable(
  'sf_email_broadcasts',
  {
    id: text('id').primaryKey(),
    label: text('label').notNull().default('Untitled broadcast'),
    templateId: text('template_id')
      .notNull()
      .references(() => sfEmailTemplates.id, { onDelete: 'restrict' }),
    moduleCategory: text('module_category').notNull().default('other'),
    /** Caller scope, e.g. events:<eventId> — used to refuse double enqueue. */
    sourceKey: text('source_key').notNull().default(''),
    /** queued | running | paused | done | cancelled | failed */
    status: text('status').notNull().default('queued'),
    batchSize: integer('batch_size').notNull().default(20),
    gapMinutes: integer('gap_minutes').notNull().default(10),
    totalCount: integer('total_count').notNull().default(0),
    sentCount: integer('sent_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    skippedCount: integer('skipped_count').notNull().default(0),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    lastError: text('last_error'),
    fromOverride: text('from_override'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_email_broadcasts_status_idx').on(table.status),
    index('sf_email_broadcasts_source_key_idx').on(table.sourceKey),
    index('sf_email_broadcasts_next_run_at_idx').on(table.nextRunAt),
    index('sf_email_broadcasts_created_at_idx').on(table.createdAt),
    index('sf_email_broadcasts_template_id_idx').on(table.templateId),
  ],
)

/** One frozen recipient row per broadcast address. */
export const sfEmailBroadcastRecipients = pgTable(
  'sf_email_broadcast_recipients',
  {
    id: text('id').primaryKey(),
    broadcastId: text('broadcast_id')
      .notNull()
      .references(() => sfEmailBroadcasts.id, { onDelete: 'cascade' }),
    email: text('email').notNull().default(''),
    /** queued | sent | failed | skipped */
    status: text('status').notNull().default('queued'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    error: text('error'),
    sortOrder: integer('sort_order').notNull().default(0),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sf_email_broadcast_recipients_broadcast_id_idx').on(table.broadcastId),
    index('sf_email_broadcast_recipients_status_idx').on(table.status),
    index('sf_email_broadcast_recipients_broadcast_status_idx').on(
      table.broadcastId,
      table.status,
    ),
  ],
)

/**
 * product:email-manager tables (sf_email_*).
 * Included via drizzle.config schema glob under src/modules.
 */

import {
  boolean,
  index,
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
 * Dashboard `email.sent` aggregates by email_type; not a full drill-down UI.
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

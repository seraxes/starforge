/**
 * product:documents tables (sf_documents_*).
 * Included via drizzle.config schema glob under src/modules.
 *
 * Slice 2: subject links (mediaId only; file bytes stay in product:media).
 * Slice 3: staff templates (no PDF bytes on the row).
 * Slice 5: link status / provider / envelope / generation + webhook receipts.
 * Cross-pack ids (subject, Media, template) are plain text — no FKs.
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/**
 * One bound or rendered file attached to a subject.
 * Unique when a template id is set: subject kind + subject id + template id + generation.
 * Without a template id, the same mediaId on that subject updates that link.
 * Generation defaults to 1. A signed generation is not overwritten; void keeps it;
 * the next contract is generation + 1 (a new link).
 */
export const sfDocumentsLinks = pgTable(
  'sf_documents_links',
  {
    id: text('id').primaryKey(),
    /** user | onboarding | fleet_vehicle */
    subjectKind: text('subject_kind').notNull(),
    subjectId: text('subject_id').notNull(),
    /** Empty when the bind has no template. */
    templateId: text('template_id').notNull().default(''),
    /** Media owns bytes; this pack stores the id only. */
    mediaId: text('media_id').notNull(),
    title: text('title').notNull().default(''),
    /**
     * draft | sent | signed | declined | void.
     * Empty means unsigned / not yet sent (render may still update).
     */
    status: text('status').notNull().default(''),
    /** Core signature adapter id (e.g. docusign). */
    providerId: text('provider_id').notNull().default(''),
    /** Provider envelope id after send. */
    envelopeId: text('envelope_id').notNull().default(''),
    /** Contract generation; defaults to 1. */
    generation: integer('generation').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: text('created_by').notNull().default(''),
  },
  (table) => [
    uniqueIndex('sf_documents_links_subject_template_gen_uidx')
      .on(table.subjectKind, table.subjectId, table.templateId, table.generation)
      .where(sql`${table.templateId} <> ''`),
    uniqueIndex('sf_documents_links_subject_media_uidx')
      .on(table.subjectKind, table.subjectId, table.mediaId)
      .where(sql`${table.templateId} = ''`),
    index('sf_documents_links_subject_idx').on(table.subjectKind, table.subjectId),
    index('sf_documents_links_media_idx').on(table.mediaId),
    index('sf_documents_links_envelope_idx').on(table.providerId, table.envelopeId),
  ],
)

/**
 * Staff-edited document template.
 * The rendered PDF is not stored here — Media keeps bytes; links hold mediaId.
 */
export const sfDocumentsTemplates = pgTable(
  'sf_documents_templates',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull().default(''),
    /** user | onboarding | fleet_vehicle */
    subjectKind: text('subject_kind').notNull(),
    /** How this template renders (e.g. values-pdf). No file bytes. */
    renderSource: text('render_source').notNull().default(''),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_documents_templates_subject_idx').on(table.subjectKind),
    index('sf_documents_templates_enabled_idx').on(table.enabled),
  ],
)

/**
 * Signature webhook receipts. Keyed by provider + provider event id so a
 * replay can see the receipt and does not insert a second signed file.
 * No foreign keys.
 */
export const sfDocumentsSignatureReceipts = pgTable(
  'sf_documents_signature_receipts',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id').notNull(),
    /** Provider event / notification id (idempotency key). */
    providerEventId: text('provider_event_id').notNull(),
    envelopeId: text('envelope_id').notNull().default(''),
    linkId: text('link_id').notNull().default(''),
    status: text('status').notNull().default(''),
    mediaId: text('media_id').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('sf_documents_signature_receipts_event_uidx').on(
      table.providerId,
      table.providerEventId,
    ),
    index('sf_documents_signature_receipts_envelope_idx').on(
      table.providerId,
      table.envelopeId,
    ),
  ],
)

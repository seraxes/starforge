/**
 * Campaign draft + send link — sf_email_campaigns + recipients.
 * Send copies saved rows into enqueueEmailBroadcast; status follows the broadcast.
 */

import 'server-only'

import { asc, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/core/db'

import { campaignStatusFromBroadcastStatus, parseCampaignRecipientPaste } from './broadcast'
import { findEmailBroadcastById } from './broadcast-store'
import {
  sfEmailBroadcasts,
  sfEmailCampaignRecipients,
  sfEmailCampaigns,
  sfEmailTemplates,
} from './schema'
import { findEmailTemplateById } from './store'
import {
  isEmailBroadcastStatus,
  isEmailCampaignStatus,
  isEmailModuleCategory,
  type EmailCampaignBroadcastProgress,
  type EmailCampaignListRow,
  type EmailCampaignRecord,
  type EmailCampaignStatus,
  type EmailModuleCategory,
} from './types'

function tableMissingMessage(error: unknown, table: string): string | null {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg.includes(table) || /does not exist|relation/i.test(msg)) {
    return `${table} missing — run npm run db:migrate (or db:core:push).`
  }
  return null
}

function mapCampaign(row: typeof sfEmailCampaigns.$inferSelect): EmailCampaignRecord {
  return {
    id: row.id,
    label: row.label?.trim() || 'Untitled campaign',
    templateId: row.templateId?.trim() || null,
    status: isEmailCampaignStatus(row.status) ? row.status : 'draft',
    broadcastId: row.broadcastId?.trim() || null,
    moduleCategory: isEmailModuleCategory(row.moduleCategory)
      ? row.moduleCategory
      : 'other',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapBroadcastProgress(
  row: typeof sfEmailBroadcasts.$inferSelect,
): EmailCampaignBroadcastProgress {
  return {
    status: isEmailBroadcastStatus(row.status) ? row.status : 'queued',
    totalCount: Number(row.totalCount) || 0,
    sentCount: Number(row.sentCount) || 0,
    failedCount: Number(row.failedCount) || 0,
    skippedCount: Number(row.skippedCount) || 0,
    nextRunAt: row.nextRunAt ?? null,
  }
}

async function writeCampaignStatus(
  id: string,
  status: EmailCampaignStatus,
): Promise<void> {
  await db
    .update(sfEmailCampaigns)
    .set({ status, updatedAt: new Date() })
    .where(eq(sfEmailCampaigns.id, id))
}

/**
 * After kickDueBroadcasts, align campaign.status with the linked broadcast when it differs.
 */
export async function syncEmailCampaignStatusFromBroadcast(
  campaign: EmailCampaignRecord,
): Promise<EmailCampaignRecord> {
  const broadcastId = campaign.broadcastId?.trim() || ''
  if (!broadcastId) return campaign

  const broadcast = await findEmailBroadcastById(broadcastId)
  if (!broadcast) return campaign

  const next = campaignStatusFromBroadcastStatus(broadcast.status)
  if (!next || next === campaign.status) return campaign

  try {
    await writeCampaignStatus(campaign.id, next)
    return { ...campaign, status: next, updatedAt: new Date() }
  } catch {
    return campaign
  }
}

/** Sync every listed row that has a broadcastId (one status write when it differs). */
export async function syncEmailCampaignListStatuses(
  rows: EmailCampaignListRow[],
): Promise<EmailCampaignListRow[]> {
  const out: EmailCampaignListRow[] = []
  for (const row of rows) {
    if (!row.broadcastId || !row.broadcast) {
      out.push(row)
      continue
    }
    const next = campaignStatusFromBroadcastStatus(row.broadcast.status)
    if (!next || next === row.status) {
      out.push(row)
      continue
    }
    try {
      await writeCampaignStatus(row.id, next)
      out.push({ ...row, status: next, updatedAt: new Date() })
    } catch {
      out.push(row)
    }
  }
  return out
}

export async function listEmailCampaigns(options?: {
  limit?: number
}): Promise<{ rows: EmailCampaignListRow[]; unavailable: boolean; error?: string }> {
  const limit = Math.min(100, Math.max(1, Math.floor(options?.limit ?? 40)))
  try {
    const campaigns = await db
      .select({
        campaign: sfEmailCampaigns,
        templateLabel: sfEmailTemplates.label,
      })
      .from(sfEmailCampaigns)
      .leftJoin(sfEmailTemplates, eq(sfEmailCampaigns.templateId, sfEmailTemplates.id))
      .orderBy(desc(sfEmailCampaigns.updatedAt))
      .limit(limit)

    const ids = campaigns.map((row) => row.campaign.id)
    const countById = new Map<string, number>()
    if (ids.length > 0) {
      const counts = await db
        .select({
          campaignId: sfEmailCampaignRecipients.campaignId,
          recipientCount: sql<number>`count(*)::int`,
        })
        .from(sfEmailCampaignRecipients)
        .where(inArray(sfEmailCampaignRecipients.campaignId, ids))
        .groupBy(sfEmailCampaignRecipients.campaignId)
      for (const row of counts) {
        countById.set(row.campaignId, Number(row.recipientCount) || 0)
      }
    }

    const broadcastIds = campaigns
      .map((row) => row.campaign.broadcastId?.trim() || '')
      .filter(Boolean)
    const broadcastById = new Map<string, EmailCampaignBroadcastProgress>()
    if (broadcastIds.length > 0) {
      const broadcasts = await db
        .select()
        .from(sfEmailBroadcasts)
        .where(inArray(sfEmailBroadcasts.id, broadcastIds))
      for (const row of broadcasts) {
        broadcastById.set(row.id, mapBroadcastProgress(row))
      }
    }

    return {
      rows: campaigns.map((row) => {
        const broadcastId = row.campaign.broadcastId?.trim() || null
        return {
          ...mapCampaign(row.campaign),
          templateLabel: row.templateLabel?.trim() || '—',
          recipientCount: countById.get(row.campaign.id) ?? 0,
          broadcast: broadcastId ? broadcastById.get(broadcastId) ?? null : null,
        }
      }),
      unavailable: false,
    }
  } catch (error) {
    const missing = tableMissingMessage(error, 'sf_email_campaigns')
    return {
      rows: [],
      unavailable: true,
      error: missing || (error instanceof Error ? error.message : 'List failed.'),
    }
  }
}

export async function findEmailCampaignById(
  id: string,
): Promise<EmailCampaignRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const [row] = await db
      .select()
      .from(sfEmailCampaigns)
      .where(eq(sfEmailCampaigns.id, trimmed))
      .limit(1)
    return row ? mapCampaign(row) : null
  } catch {
    return null
  }
}

export async function listEmailCampaignRecipientEmails(
  campaignId: string,
): Promise<string[]> {
  const id = campaignId.trim()
  if (!id) return []
  try {
    const rows = await db
      .select({ email: sfEmailCampaignRecipients.email })
      .from(sfEmailCampaignRecipients)
      .where(eq(sfEmailCampaignRecipients.campaignId, id))
      .orderBy(asc(sfEmailCampaignRecipients.sortOrder), asc(sfEmailCampaignRecipients.id))
    return rows.map((r) => r.email).filter(Boolean)
  } catch {
    return []
  }
}

export async function createEmailCampaign(input: {
  label: string
}): Promise<{ campaign: EmailCampaignRecord } | { error: string }> {
  const label = input.label.trim().slice(0, 200) || 'Untitled campaign'
  const id = crypto.randomUUID()
  try {
    await db.insert(sfEmailCampaigns).values({
      id,
      label,
      status: 'draft',
      moduleCategory: 'other',
    })
    const created = await findEmailCampaignById(id)
    if (!created) return { error: 'Campaign created but could not be reloaded.' }
    return { campaign: created }
  } catch (error) {
    const missing = tableMissingMessage(error, 'sf_email_campaigns')
    if (missing) return { error: missing }
    return {
      error: error instanceof Error ? error.message : 'Could not create campaign.',
    }
  }
}

export async function updateEmailCampaignDraft(input: {
  id: string
  label: string
  templateId: string
  recipientsPaste: string
}): Promise<
  | { campaign: EmailCampaignRecord; truncated: boolean; recipientCount: number }
  | { error: string }
> {
  const id = input.id.trim()
  if (!id) return { error: 'Campaign id is required.' }

  const label = input.label.trim().slice(0, 200)
  if (!label) return { error: 'Label is required.' }

  const templateId = input.templateId.trim()
  if (!templateId) return { error: 'Template is required.' }

  const existing = await findEmailCampaignById(id)
  if (!existing) return { error: 'Campaign not found.' }
  if (existing.status !== 'draft') {
    return { error: 'Only draft campaigns can be edited.' }
  }

  const template = await findEmailTemplateById(templateId)
  if (!template) return { error: 'Template not found.' }

  const { recipients, truncated } = parseCampaignRecipientPaste(input.recipientsPaste)
  const moduleCategory: EmailModuleCategory = template.moduleCategory

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(sfEmailCampaigns)
        .set({
          label,
          templateId,
          moduleCategory,
          status: 'draft' satisfies EmailCampaignStatus,
          updatedAt: new Date(),
        })
        .where(eq(sfEmailCampaigns.id, id))

      await tx
        .delete(sfEmailCampaignRecipients)
        .where(eq(sfEmailCampaignRecipients.campaignId, id))

      if (recipients.length > 0) {
        await tx.insert(sfEmailCampaignRecipients).values(
          recipients.map((row, index) => ({
            id: crypto.randomUUID(),
            campaignId: id,
            email: row.email,
            sortOrder: index,
          })),
        )
      }
    })

    const updated = await findEmailCampaignById(id)
    if (!updated) return { error: 'Campaign saved but could not be reloaded.' }
    return {
      campaign: updated,
      truncated,
      recipientCount: recipients.length,
    }
  } catch (error) {
    const missing =
      tableMissingMessage(error, 'sf_email_campaigns') ||
      tableMissingMessage(error, 'sf_email_campaign_recipients')
    if (missing) return { error: missing }
    return {
      error: error instanceof Error ? error.message : 'Could not save campaign.',
    }
  }
}

/** Attach a paced broadcast and flip the campaign to sending. */
export async function linkEmailCampaignBroadcast(input: {
  id: string
  broadcastId: string
}): Promise<{ campaign: EmailCampaignRecord } | { error: string }> {
  const id = input.id.trim()
  const broadcastId = input.broadcastId.trim()
  if (!id) return { error: 'Campaign id is required.' }
  if (!broadcastId) return { error: 'Broadcast id is required.' }

  try {
    await db
      .update(sfEmailCampaigns)
      .set({
        broadcastId,
        status: 'sending' satisfies EmailCampaignStatus,
        updatedAt: new Date(),
      })
      .where(eq(sfEmailCampaigns.id, id))

    const updated = await findEmailCampaignById(id)
    if (!updated) return { error: 'Campaign linked but could not be reloaded.' }
    return { campaign: updated }
  } catch (error) {
    const missing = tableMissingMessage(error, 'sf_email_campaigns')
    if (missing) return { error: missing }
    return {
      error: error instanceof Error ? error.message : 'Could not link broadcast.',
    }
  }
}

export async function deleteEmailCampaign(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Campaign id is required.' }

  const existing = await findEmailCampaignById(trimmed)
  if (!existing) return { error: 'Campaign not found.' }
  if (existing.status !== 'draft') {
    return { error: 'Only draft campaigns can be deleted.' }
  }

  try {
    await db.delete(sfEmailCampaigns).where(eq(sfEmailCampaigns.id, trimmed))
    return { ok: true }
  } catch (error) {
    const missing = tableMissingMessage(error, 'sf_email_campaigns')
    if (missing) return { error: missing }
    return {
      error: error instanceof Error ? error.message : 'Could not delete campaign.',
    }
  }
}

/**
 * Paced broadcast enqueue + drain — Email Manager only (Mailer via getMailer).
 * Soft-fails; never throws into callers.
 */

import 'server-only'

import { getMailer } from '@/core/mail'
import { getJobRunner, registerJobHandler } from '@/core/jobs'

import {
  EMAIL_BROADCAST_DRAIN_JOB,
  applyBroadcastRecipientCap,
  clampBroadcastBatchSize,
  clampBroadcastGapMinutes,
  normalizeBroadcastRecipients,
} from './broadcast'
import {
  countQueuedRecipients,
  createBroadcastWithRecipients,
  findEmailBroadcastById,
  findInFlightBroadcastBySourceKey,
  getBroadcastFromOverride,
  listDueBroadcasts,
  listQueuedRecipients,
  markRecipientStatus,
  updateBroadcastStatus,
} from './broadcast-store'
import { isEmailManagerEnabled } from './engine'
import { emailTypeFromModuleCategory } from './send-type'
import { loadEmailManagerModuleSettings } from './settings'
import { findEmailTemplateById } from './store'
import { renderEmailTemplate } from './template-render'
import {
  EMAIL_BROADCAST_RECIPIENT_CAP,
  isEmailModuleCategory,
  type EmailBroadcastEnqueueInput,
  type EmailBroadcastEnqueueResult,
} from './types'

let drainJobRegistered = false

/** Idempotent — safe from enqueue / admin page load. */
export function ensureEmailBroadcastDrainJob(): void {
  if (drainJobRegistered) return
  drainJobRegistered = true

  registerJobHandler(EMAIL_BROADCAST_DRAIN_JOB, async (payload) => {
    const broadcastId = String(payload.broadcastId || '').trim()
    if (!broadcastId) return
    await drainBroadcastBatch(broadcastId)
  })
}

async function scheduleDrain(
  broadcastId: string,
  runAt?: Date,
): Promise<void> {
  ensureEmailBroadcastDrainJob()
  const id = broadcastId.trim()
  if (!id) return
  const when = runAt && Number.isFinite(runAt.getTime()) ? runAt : new Date()
  const key = `${EMAIL_BROADCAST_DRAIN_JOB}:${id}:${when.getTime()}`
  try {
    await getJobRunner().enqueue({
      name: EMAIL_BROADCAST_DRAIN_JOB,
      payload: { broadcastId: id },
      runAt: when,
      idempotencyKey: key,
    })
  } catch (error) {
    console.error('[email-manager] broadcast drain enqueue failed', error)
  }
}

/**
 * Start any due queued/running broadcasts (page load / after enqueue).
 * Needed because JobRunner memory timers do not survive restarts.
 */
export async function kickDueBroadcasts(): Promise<number> {
  ensureEmailBroadcastDrainJob()
  const due = await listDueBroadcasts(20)
  for (const row of due) {
    await scheduleDrain(row.id, row.nextRunAt || new Date())
  }
  return due.length
}

/**
 * Enqueue a paced broadcast. Callers pass template id + recipient rows.
 * Never call getMailer() from product packs — this path owns transport.
 */
export async function enqueueEmailBroadcast(
  input: EmailBroadcastEnqueueInput,
): Promise<EmailBroadcastEnqueueResult> {
  const templateId = (input.templateId || '').trim()
  const sourceKey = (input.sourceKey || '').trim()
  const label = (input.label || '').trim() || 'Untitled broadcast'

  if (!templateId) {
    return { ok: false, error: 'Template id is required.' }
  }
  if (!sourceKey) {
    return { ok: false, error: 'Source key is required.' }
  }

  try {
    if (!(await isEmailManagerEnabled())) {
      return {
        ok: false,
        skipped: true,
        error: 'Email Manager module is disabled.',
      }
    }

    const existing = await findInFlightBroadcastBySourceKey(sourceKey)
    if (existing) {
      return {
        ok: true,
        skipped: true,
        alreadyRunning: true,
        broadcastId: existing.id,
        totalCount: existing.totalCount,
        batchSize: existing.batchSize,
        gapMinutes: existing.gapMinutes,
        message: `A broadcast for this source is already ${existing.status} (${existing.sentCount}/${existing.totalCount} sent).`,
      }
    }

    const template = await findEmailTemplateById(templateId)
    if (!template) {
      return { ok: false, error: 'Template not found.' }
    }

    const normalized = normalizeBroadcastRecipients(input.recipients || [])
    if (!normalized.length) {
      return { ok: false, error: 'No valid recipient addresses.' }
    }

    const capped = applyBroadcastRecipientCap(normalized, EMAIL_BROADCAST_RECIPIENT_CAP)
    if (!capped.recipients.length) {
      return { ok: false, error: 'No recipients after applying the broadcast cap.' }
    }

    const pace = await loadEmailManagerModuleSettings()
    const batchSize = clampBroadcastBatchSize(pace.settings.broadcastBatchSize)
    const gapMinutes = clampBroadcastGapMinutes(pace.settings.broadcastGapMinutes)
    const moduleCategory = isEmailModuleCategory(input.moduleCategory)
      ? input.moduleCategory
      : isEmailModuleCategory(template.moduleCategory)
        ? template.moduleCategory
        : 'other'

    const broadcastId = crypto.randomUUID()
    const created = await createBroadcastWithRecipients({
      id: broadcastId,
      label,
      templateId: template.id,
      moduleCategory,
      sourceKey,
      batchSize,
      gapMinutes,
      totalCount: capped.recipients.length,
      fromOverride: input.from?.trim() || undefined,
      recipients: capped.recipients.map((r, i) => ({
        id: crypto.randomUUID(),
        email: r.email,
        payload: r.payload,
        sortOrder: i,
      })),
    })

    if (!created.ok) {
      return { ok: false, error: created.error }
    }

    await scheduleDrain(broadcastId, new Date())

    const truncatedNote = capped.truncated
      ? ` Cap ${EMAIL_BROADCAST_RECIPIENT_CAP} applied.`
      : ''
    return {
      ok: true,
      broadcastId,
      totalCount: capped.recipients.length,
      batchSize,
      gapMinutes,
      message: `Queued ${capped.recipients.length} recipients, ${batchSize} every ${gapMinutes} minutes.${truncatedNote}`,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Enqueue failed.',
    }
  }
}

async function drainBroadcastBatch(broadcastId: string): Promise<void> {
  const broadcast = await findEmailBroadcastById(broadcastId)
  if (!broadcast) return

  if (broadcast.status === 'paused' || broadcast.status === 'cancelled') {
    return
  }
  if (broadcast.status === 'done' || broadcast.status === 'failed') {
    return
  }

  if (!(await isEmailManagerEnabled())) {
    await updateBroadcastStatus(broadcastId, {
      status: 'paused',
      lastError: 'Email Manager module is disabled.',
    })
    return
  }

  const template = await findEmailTemplateById(broadcast.templateId)
  if (!template) {
    await updateBroadcastStatus(broadcastId, {
      status: 'failed',
      lastError: 'Template not found.',
      nextRunAt: null,
    })
    return
  }

  await updateBroadcastStatus(broadcastId, {
    status: 'running',
    lastError: null,
  })

  const mailer = await getMailer()
  const info = mailer.info()
  if (!info.enabled) {
    await updateBroadcastStatus(broadcastId, {
      status: 'paused',
      lastError: 'Outbound email is disabled in Chrome.',
    })
    return
  }

  const batchSize = clampBroadcastBatchSize(broadcast.batchSize)
  const recipients = await listQueuedRecipients(broadcastId, batchSize)
  if (!recipients.length) {
    await updateBroadcastStatus(broadcastId, {
      status: 'done',
      nextRunAt: null,
    })
    return
  }

  const fromOverride =
    (await getBroadcastFromOverride(broadcastId)) || undefined
  let sentDelta = 0
  let failedDelta = 0
  let skippedDelta = 0

  for (const row of recipients) {
    // Re-check pause/cancel between sends.
    const live = await findEmailBroadcastById(broadcastId)
    if (!live || live.status === 'paused' || live.status === 'cancelled') {
      return
    }

    try {
      const rendered = renderEmailTemplate({
        subject: template.subject,
        bodyText: template.bodyText,
        bodyHtml: template.bodyHtml || undefined,
        payload: row.payload || {},
      })

      const sendResult = await mailer.send({
        to: row.email,
        from: fromOverride,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        meta: {
          emailType: emailTypeFromModuleCategory(broadcast.moduleCategory),
          title: template.label || broadcast.label,
          source: 'email-manager-broadcast',
          templateId: template.id,
          moduleCategory: broadcast.moduleCategory,
          ruleId: broadcast.id,
        },
      })

      if (sendResult.skipped) {
        await markRecipientStatus(row.id, 'skipped', sendResult.error || null)
        skippedDelta += 1
      } else if (sendResult.ok) {
        await markRecipientStatus(row.id, 'sent')
        sentDelta += 1
      } else {
        await markRecipientStatus(row.id, 'failed', sendResult.error || 'Send failed.')
        failedDelta += 1
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Send failed.'
      await markRecipientStatus(row.id, 'failed', msg)
      failedDelta += 1
    }
  }

  const refreshed = await findEmailBroadcastById(broadcastId)
  if (!refreshed) return
  if (refreshed.status === 'paused' || refreshed.status === 'cancelled') {
    return
  }

  const nextSent = refreshed.sentCount + sentDelta
  const nextFailed = refreshed.failedCount + failedDelta
  const nextSkipped = refreshed.skippedCount + skippedDelta
  const remaining = await countQueuedRecipients(broadcastId)

  if (remaining <= 0) {
    await updateBroadcastStatus(broadcastId, {
      status: 'done',
      sentCount: nextSent,
      failedCount: nextFailed,
      skippedCount: nextSkipped,
      nextRunAt: null,
      lastError: null,
    })
    return
  }

  const gapMinutes = clampBroadcastGapMinutes(refreshed.gapMinutes)
  const nextRunAt = new Date(Date.now() + gapMinutes * 60_000)
  await updateBroadcastStatus(broadcastId, {
    status: 'running',
    sentCount: nextSent,
    failedCount: nextFailed,
    skippedCount: nextSkipped,
    nextRunAt,
    lastError: null,
  })
  await scheduleDrain(broadcastId, nextRunAt)
}

export async function pauseEmailBroadcast(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const broadcast = await findEmailBroadcastById(id)
  if (!broadcast) return { ok: false, error: 'Broadcast not found.' }
  if (broadcast.status !== 'queued' && broadcast.status !== 'running') {
    return { ok: false, error: `Cannot pause a ${broadcast.status} broadcast.` }
  }
  await updateBroadcastStatus(broadcast.id, {
    status: 'paused',
    nextRunAt: null,
  })
  return { ok: true }
}

export async function resumeEmailBroadcast(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const broadcast = await findEmailBroadcastById(id)
  if (!broadcast) return { ok: false, error: 'Broadcast not found.' }
  if (broadcast.status !== 'paused') {
    return { ok: false, error: `Cannot resume a ${broadcast.status} broadcast.` }
  }
  const remaining = await countQueuedRecipients(broadcast.id)
  if (remaining <= 0) {
    await updateBroadcastStatus(broadcast.id, {
      status: 'done',
      nextRunAt: null,
    })
    return { ok: true }
  }
  const now = new Date()
  await updateBroadcastStatus(broadcast.id, {
    status: 'queued',
    nextRunAt: now,
    lastError: null,
  })
  await scheduleDrain(broadcast.id, now)
  return { ok: true }
}

export async function cancelEmailBroadcast(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const broadcast = await findEmailBroadcastById(id)
  if (!broadcast) return { ok: false, error: 'Broadcast not found.' }
  if (
    broadcast.status === 'done' ||
    broadcast.status === 'cancelled' ||
    broadcast.status === 'failed'
  ) {
    return { ok: false, error: `Broadcast is already ${broadcast.status}.` }
  }
  await updateBroadcastStatus(broadcast.id, {
    status: 'cancelled',
    nextRunAt: null,
  })
  return { ok: true }
}

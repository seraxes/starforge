/**
 * Soft-fail Social activity card after an event is published.
 * Calls `loadModuleDoor('social-api-server')` → `publishActivity`.
 * Never imports Social store / schema / actions. Social off or pack switch off
 * returns disabled on the door — this helper ignores non-ok and never throws.
 */

import { eventPublicPathKey } from './public/path'
import type { EventRecord } from './types'

export const EVENTS_ACTIVITY_SOURCE_MODULE = 'product:events'
export const EVENTS_ACTIVITY_KIND = 'event.published'

export type EventActivityPublishInput = {
  event: Pick<EventRecord, 'id' | 'title' | 'slug' | 'status' | 'coverMediaId'>
  actorUserId: string
}

/** Minimal door shape — keep Events free of Social type imports. */
export type SocialPublishActivityFn = (input: {
  sourceModule: string
  sourceId: string
  activityKind: string
  actorUserId: string
  snapshot?: {
    title?: string
    href?: string
    mediaId?: string
    [key: string]: unknown
  } | null
}) => Promise<{ ok: true } | { ok: false; reason: string }>

export type NotifyEventPublishedDeps = {
  loadPublishActivity?: () => Promise<SocialPublishActivityFn | null>
}

async function defaultLoadPublishActivity(): Promise<SocialPublishActivityFn | null> {
  try {
    const { loadModuleDoor } = await import('@/generated/module-registry.server')
    const door = await loadModuleDoor('social-api-server')
    const fn = door?.publishActivity as SocialPublishActivityFn | undefined
    return typeof fn === 'function' ? fn : null
  } catch {
    return null
  }
}

/**
 * After a successful Events write with status=published, upsert the activity card.
 * Draft / cancelled / missing actor → no-op. Door errors are logged only.
 */
export async function notifyEventPublishedActivity(
  input: EventActivityPublishInput,
  deps?: NotifyEventPublishedDeps,
): Promise<void> {
  if (input.event.status !== 'published') return
  const actorUserId = input.actorUserId.trim()
  const sourceId = input.event.id.trim()
  if (!actorUserId || !sourceId) return

  try {
    const publishActivity =
      (await (deps?.loadPublishActivity ?? defaultLoadPublishActivity)()) ?? null
    if (!publishActivity) return

    const mediaId = (input.event.coverMediaId || '').trim()
    await publishActivity({
      sourceModule: EVENTS_ACTIVITY_SOURCE_MODULE,
      sourceId,
      activityKind: EVENTS_ACTIVITY_KIND,
      actorUserId,
      snapshot: {
        title: input.event.title,
        href: `/events/${eventPublicPathKey(input.event)}`,
        ...(mediaId ? { mediaId } : {}),
      },
    })
  } catch (error) {
    console.error('[events] publishActivity failed', error)
  }
}

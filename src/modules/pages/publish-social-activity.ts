/**
 * Soft-fail Social activity card after a site page is published.
 * Calls `loadModuleDoor('social-api-server')` → `publishActivity`.
 * Never imports Social store / schema / actions. Social off or pack switch off
 * returns disabled on the door — this helper ignores non-ok and never throws.
 */

import { barePathForSlug } from '@/core/nav/root-target'

import type { PageRecord } from './types'

export const PAGES_ACTIVITY_SOURCE_MODULE = 'product:pages'
export const PAGES_ACTIVITY_KIND = 'page.published'

export type PageActivityPublishInput = {
  page: Pick<PageRecord, 'id' | 'title' | 'slug' | 'status' | 'metaMediaId'>
  actorUserId: string
}

/** Minimal door shape — keep Pages free of Social type imports. */
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

export type NotifyPagePublishedDeps = {
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
 * After a successful Pages write with status=published, upsert the activity card.
 * Draft / unpublished / missing actor → no-op. Door errors are logged only.
 */
export async function notifyPagePublishedActivity(
  input: PageActivityPublishInput,
  deps?: NotifyPagePublishedDeps,
): Promise<void> {
  if (input.page.status !== 'published') return
  const actorUserId = input.actorUserId.trim()
  const sourceId = input.page.id.trim()
  if (!actorUserId || !sourceId) return

  try {
    const publishActivity =
      (await (deps?.loadPublishActivity ?? defaultLoadPublishActivity)()) ?? null
    if (!publishActivity) return

    const mediaId = (input.page.metaMediaId || '').trim()
    await publishActivity({
      sourceModule: PAGES_ACTIVITY_SOURCE_MODULE,
      sourceId,
      activityKind: PAGES_ACTIVITY_KIND,
      actorUserId,
      snapshot: {
        title: input.page.title,
        href: barePathForSlug(input.page.slug, undefined),
        ...(mediaId ? { mediaId } : {}),
      },
    })
  } catch (error) {
    console.error('[pages] publishActivity failed', error)
  }
}

/**
 * product:social activity cards — publishActivity door.
 *
 * Unique on (sourceModule, sourceId, activityKind). A republish updates that
 * row (and its linked activity post). Not composed by the member. Events and
 * Pages callers are separate chats; this pack never throws out of the door so
 * a Social failure does not fail their publish. Off → disabled, no write.
 */

import { runSocialDoor, type SocialDoorResult } from './door'
import { isPostAudience, type PostAudience, type PostRecord } from './posts'

/** Snapshot fallback when the source pack can no longer resolve the card. */
export type ActivitySnapshot = {
  title?: string
  href?: string
  mediaId?: string
  [key: string]: unknown
}

export type ActivityRecord = {
  id: string
  sourceModule: string
  sourceId: string
  activityKind: string
  actorUserId: string
  postId: string
  snapshot: ActivitySnapshot
  createdAt: Date
  updatedAt: Date
}

export type PublishActivityInput = {
  sourceModule: string
  sourceId: string
  activityKind: string
  actorUserId: string
  snapshot?: ActivitySnapshot | null
  /** Default friends — card shows on the actor’s friends’ feeds. */
  audience?: PostAudience
}

export type ActivityRefuseReason = 'invalid' | 'disabled' | 'failed'

export type PublishActivityResult =
  | { ok: true; activity: ActivityRecord; post: PostRecord }
  | { ok: false; reason: ActivityRefuseReason }

export type PublishActivityDecision =
  | {
      ok: true
      write: 'insert' | 'update' | 'noop'
      activity: ActivityRecord
      post: PostRecord
    }
  | { ok: false; reason: ActivityRefuseReason }

export type ActivityBag = {
  activities: Map<string, ActivityRecord>
  posts: Map<string, PostRecord>
}

function activityKey(
  sourceModule: string,
  sourceId: string,
  activityKind: string,
): string {
  return `${sourceModule}\0${sourceId}\0${activityKind}`
}

function normalizeSnapshot(raw: ActivitySnapshot | null | undefined): ActivitySnapshot {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return { ...raw }
}

function snapshotTitle(snapshot: ActivitySnapshot): string {
  const title = snapshot.title
  return typeof title === 'string' ? title.trim() : ''
}

/**
 * Decide insert / update for one activity card + linked kind=activity post.
 * Unique key is (sourceModule, sourceId, activityKind) — never a second row.
 */
export function decidePublishActivity(
  current: ActivityRecord | null,
  currentPost: PostRecord | null,
  input: PublishActivityInput,
  opts?: { now?: Date; newId?: () => string },
): PublishActivityDecision {
  const sourceModule = input.sourceModule.trim()
  const sourceId = input.sourceId.trim()
  const activityKind = input.activityKind.trim()
  const actorUserId = input.actorUserId.trim()
  if (!sourceModule || !sourceId || !activityKind || !actorUserId) {
    return { ok: false, reason: 'invalid' }
  }

  const snapshot = normalizeSnapshot(input.snapshot)
  const audienceRaw = input.audience ?? 'friends'
  if (!isPostAudience(audienceRaw)) return { ok: false, reason: 'invalid' }
  const audience: PostAudience = audienceRaw
  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const body = snapshotTitle(snapshot)

  if (current) {
    if (
      current.sourceModule !== sourceModule ||
      current.sourceId !== sourceId ||
      current.activityKind !== activityKind
    ) {
      return { ok: false, reason: 'invalid' }
    }

    const post =
      currentPost && currentPost.id === current.postId
        ? currentPost
        : ({
            id: current.postId,
            authorUserId: actorUserId,
            body,
            kind: 'activity' as const,
            audience,
            groupId: null,
            pageId: null,
            staffHidden: false,
            isAnnouncement: false,
            editedAt: null,
            extensions: {},
            media: [],
            sharedPostId: null,
            linkUrl: null,
            linkTitle: null,
            linkDescription: null,
            linkImageUrl: null,
            pollOptions: [],
            pollClosedAt: null,
            placeLabel: null,
            mapsPinId: null,
            placeLat: null,
            placeLng: null,
            createdAt: current.createdAt,
            updatedAt: now,
          } satisfies PostRecord)

    const sameSnapshot =
      JSON.stringify(current.snapshot) === JSON.stringify(snapshot) &&
      current.actorUserId === actorUserId &&
      post.body === body &&
      post.audience === audience &&
      post.authorUserId === actorUserId

    if (sameSnapshot) {
      return { ok: true, write: 'noop', activity: current, post }
    }

    const nextActivity: ActivityRecord = {
      ...current,
      actorUserId,
      snapshot,
      updatedAt: now,
    }
    const nextPost: PostRecord = {
      ...post,
      authorUserId: actorUserId,
      body,
      kind: 'activity',
      audience,
      updatedAt: now,
    }
    return { ok: true, write: 'update', activity: nextActivity, post: nextPost }
  }

  const postId = newId()
  const activityId = newId()
  const post: PostRecord = {
    id: postId,
    authorUserId: actorUserId,
    body,
    kind: 'activity',
    audience,
    groupId: null,
    pageId: null,
    staffHidden: false,
    isAnnouncement: false,
    editedAt: null,
    extensions: {},
    media: [],
    sharedPostId: null,
    linkUrl: null,
    linkTitle: null,
    linkDescription: null,
    linkImageUrl: null,
    pollOptions: [],
    pollClosedAt: null,
    placeLabel: null,
    mapsPinId: null,
    placeLat: null,
    placeLng: null,
    createdAt: now,
    updatedAt: now,
  }
  const activity: ActivityRecord = {
    id: activityId,
    sourceModule,
    sourceId,
    activityKind,
    actorUserId,
    postId,
    snapshot,
    createdAt: now,
    updatedAt: now,
  }
  return { ok: true, write: 'insert', activity, post }
}

/** Apply a publish decision into an in-memory bag (unit tests). */
export function applyPublishActivity(
  bag: ActivityBag,
  input: PublishActivityInput,
  opts?: { now?: Date; newId?: () => string },
): PublishActivityResult {
  const sourceModule = input.sourceModule.trim()
  const sourceId = input.sourceId.trim()
  const activityKind = input.activityKind.trim()
  const key =
    sourceModule && sourceId && activityKind
      ? activityKey(sourceModule, sourceId, activityKind)
      : null
  const current = key
    ? ([...bag.activities.values()].find(
        (row) =>
          row.sourceModule === sourceModule &&
          row.sourceId === sourceId &&
          row.activityKind === activityKind,
      ) ?? null)
    : null
  const currentPost = current ? (bag.posts.get(current.postId) ?? null) : null
  const decision = decidePublishActivity(current, currentPost, input, opts)
  if (!decision.ok) return decision

  if (decision.write === 'insert' || decision.write === 'update') {
    bag.activities.set(decision.activity.id, decision.activity)
    bag.posts.set(decision.post.id, decision.post)
  }
  return { ok: true, activity: decision.activity, post: decision.post }
}

/**
 * Door-shaped publish: when Social is off, returns disabled and never writes.
 * Callers (Events / Pages) keep their publish even if this returns not-ok.
 */
export async function publishActivityThroughDoor(
  isEnabled: boolean | (() => boolean | Promise<boolean>),
  bag: ActivityBag,
  input: PublishActivityInput,
  opts?: { now?: Date; newId?: () => string },
): Promise<SocialDoorResult<PublishActivityResult>> {
  return runSocialDoor(isEnabled, () => applyPublishActivity(bag, input, opts))
}

export function createActivityMemory(opts?: {
  now?: () => Date
  newId?: () => string
}): {
  bag: ActivityBag
  publish: (input: PublishActivityInput) => PublishActivityResult
  publishThroughDoor: (
    isEnabled: boolean,
    input: PublishActivityInput,
  ) => Promise<SocialDoorResult<PublishActivityResult>>
  findByKey: (
    sourceModule: string,
    sourceId: string,
    activityKind: string,
  ) => ActivityRecord | null
  count: () => number
} {
  const bag: ActivityBag = {
    activities: new Map(),
    posts: new Map(),
  }
  const now = opts?.now ?? (() => new Date())
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  return {
    bag,
    publish: (input) =>
      applyPublishActivity(bag, input, { now: now(), newId }),
    publishThroughDoor: (isEnabled, input) =>
      publishActivityThroughDoor(isEnabled, bag, input, { now: now(), newId }),
    findByKey: (sourceModule, sourceId, activityKind) => {
      const sm = sourceModule.trim()
      const sid = sourceId.trim()
      const kind = activityKind.trim()
      for (const row of bag.activities.values()) {
        if (
          row.sourceModule === sm &&
          row.sourceId === sid &&
          row.activityKind === kind
        ) {
          return row
        }
      }
      return null
    },
    count: () => bag.activities.size,
  }
}

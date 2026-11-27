/**
 * product:social host conversations — event / CMS page threads.
 *
 * One row per (hostModule, hostId) links a kind=conversation post so comments,
 * reactions, and reports reuse sf_social_comments rules. Not a feed card.
 * Events / Pages call the door via loadModuleDoor('social-api-server').
 */

import { runSocialDoor, type SocialDoorResult } from './door'
import type { PostRecord } from './posts'

export const HOST_CONVERSATION_MODULES = ['product:events', 'product:pages'] as const
export type HostConversationModule = (typeof HOST_CONVERSATION_MODULES)[number]

export type HostConversationRecord = {
  id: string
  hostModule: string
  hostId: string
  postId: string
  hostPath: string | null
  createdAt: Date
  updatedAt: Date
}

export type EnsureHostConversationInput = {
  hostModule: string
  hostId: string
  /** Optional public path for revalidatePath after writes. */
  hostPath?: string | null
}

export type HostConversationRefuseReason = 'invalid' | 'disabled' | 'failed'

export type EnsureHostConversationResult =
  | { ok: true; conversation: HostConversationRecord; post: PostRecord }
  | { ok: false; reason: HostConversationRefuseReason }

export type EnsureHostConversationDecision =
  | {
      ok: true
      write: 'insert' | 'noop' | 'update'
      conversation: HostConversationRecord
      post: PostRecord
    }
  | { ok: false; reason: HostConversationRefuseReason }

export type HostConversationBag = {
  conversations: Map<string, HostConversationRecord>
  posts: Map<string, PostRecord>
}

export function isHostConversationModule(value: string): value is HostConversationModule {
  return (HOST_CONVERSATION_MODULES as readonly string[]).includes(value)
}

/** Synthetic post author — not a member id; canInteract still checks the actor. */
export function hostConversationAuthorId(hostModule: string, hostId: string): string {
  return `host:${hostModule.trim()}:${hostId.trim()}`
}

function hostKey(hostModule: string, hostId: string): string {
  return `${hostModule}\0${hostId}`
}

function emptyConversationPost(
  id: string,
  authorUserId: string,
  now: Date,
): PostRecord {
  return {
    id,
    authorUserId,
    body: '',
    kind: 'conversation',
    audience: 'public',
    groupId: null,
    pageId: null,
    staffHidden: false,
    pendingReview: false,
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
}

/**
 * Decide insert / update for one host conversation + linked kind=conversation post.
 * Unique key is (hostModule, hostId) — never a second row.
 */
export function decideEnsureHostConversation(
  current: HostConversationRecord | null,
  currentPost: PostRecord | null,
  input: EnsureHostConversationInput,
  opts?: { now?: Date; newId?: () => string },
): EnsureHostConversationDecision {
  const hostModule = input.hostModule.trim()
  const hostId = input.hostId.trim()
  if (!hostModule || !hostId || !isHostConversationModule(hostModule)) {
    return { ok: false, reason: 'invalid' }
  }

  const hostPathRaw = input.hostPath?.trim() || null
  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const authorUserId = hostConversationAuthorId(hostModule, hostId)

  if (current) {
    if (current.hostModule !== hostModule || current.hostId !== hostId) {
      return { ok: false, reason: 'invalid' }
    }
    const post =
      currentPost && currentPost.id === current.postId
        ? currentPost
        : emptyConversationPost(current.postId, authorUserId, current.createdAt)

    const nextPath = hostPathRaw ?? current.hostPath
    const same =
      current.hostPath === nextPath &&
      post.kind === 'conversation' &&
      post.authorUserId === authorUserId

    if (same) {
      return { ok: true, write: 'noop', conversation: current, post }
    }

    const nextConversation: HostConversationRecord = {
      ...current,
      hostPath: nextPath,
      updatedAt: now,
    }
    const nextPost: PostRecord = {
      ...post,
      authorUserId,
      kind: 'conversation',
      updatedAt: now,
    }
    return {
      ok: true,
      write: 'update',
      conversation: nextConversation,
      post: nextPost,
    }
  }

  const postId = newId()
  const conversationId = newId()
  const post = emptyConversationPost(postId, authorUserId, now)
  const conversation: HostConversationRecord = {
    id: conversationId,
    hostModule,
    hostId,
    postId,
    hostPath: hostPathRaw,
    createdAt: now,
    updatedAt: now,
  }
  return { ok: true, write: 'insert', conversation, post }
}

export function applyEnsureHostConversation(
  bag: HostConversationBag,
  input: EnsureHostConversationInput,
  opts?: { now?: Date; newId?: () => string },
): EnsureHostConversationResult {
  const hostModule = input.hostModule.trim()
  const hostId = input.hostId.trim()
  const current =
    hostModule && hostId
      ? ([...bag.conversations.values()].find(
          (row) => row.hostModule === hostModule && row.hostId === hostId,
        ) ?? null)
      : null
  const currentPost = current ? (bag.posts.get(current.postId) ?? null) : null
  const decision = decideEnsureHostConversation(current, currentPost, input, opts)
  if (!decision.ok) return decision
  if (decision.write === 'insert' || decision.write === 'update') {
    bag.conversations.set(decision.conversation.id, decision.conversation)
    bag.posts.set(decision.post.id, decision.post)
  }
  return { ok: true, conversation: decision.conversation, post: decision.post }
}

export async function ensureHostConversationThroughDoor(
  isEnabled: boolean | (() => boolean | Promise<boolean>),
  bag: HostConversationBag,
  input: EnsureHostConversationInput,
  opts?: { now?: Date; newId?: () => string },
): Promise<SocialDoorResult<EnsureHostConversationResult>> {
  return runSocialDoor(isEnabled, () => applyEnsureHostConversation(bag, input, opts))
}

export function createHostConversationMemory(opts?: {
  now?: () => Date
  newId?: () => string
}): {
  bag: HostConversationBag
  ensure: (input: EnsureHostConversationInput) => EnsureHostConversationResult
  ensureThroughDoor: (
    isEnabled: boolean,
    input: EnsureHostConversationInput,
  ) => Promise<SocialDoorResult<EnsureHostConversationResult>>
  findByHost: (hostModule: string, hostId: string) => HostConversationRecord | null
  findByPostId: (postId: string) => HostConversationRecord | null
} {
  const bag: HostConversationBag = {
    conversations: new Map(),
    posts: new Map(),
  }
  const now = opts?.now ?? (() => new Date())
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  return {
    bag,
    ensure: (input) =>
      applyEnsureHostConversation(bag, input, { now: now(), newId }),
    ensureThroughDoor: (isEnabled, input) =>
      ensureHostConversationThroughDoor(isEnabled, bag, input, {
        now: now(),
        newId,
      }),
    findByHost: (hostModule, hostId) => {
      const key = hostKey(hostModule.trim(), hostId.trim())
      for (const row of bag.conversations.values()) {
        if (hostKey(row.hostModule, row.hostId) === key) return row
      }
      return null
    },
    findByPostId: (postId) => {
      const id = postId.trim()
      if (!id) return null
      for (const row of bag.conversations.values()) {
        if (row.postId === id) return row
      }
      return null
    },
  }
}

/**
 * product:media — member upload ledger helpers (server-only).
 *
 * Members (non-admins) may upload images through the shared Media pipeline, but
 * only ever attach / re-use images recorded against their own user id here.
 * Consumers (Profiles avatar/cover; later Marketplace / Social) call
 * `memberOwnsMedia` before storing a member-supplied `mediaId`.
 */

import 'server-only'

import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/core/db'
import { resolveMediaById, type ResolvedMedia } from '@/core/media/resolve'

import { sfMediaOwners } from './schema'

/** Default per-file ceiling for member uploads (5 MiB; Forms hard ceiling is 10 MiB). */
export const MEMBER_UPLOAD_MAX_BYTES = 5 * 1024 * 1024

/** Raster only — SVG is never accepted from members (stored XSS). */
export const MEMBER_UPLOAD_MIME = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const

/** Uploads per member per hour (RateLimiter port). */
export const MEMBER_UPLOAD_HOURLY_LIMIT = 20

const CONTEXT_RE = /^[a-z0-9][a-z0-9-]{0,31}$/

/** Normalize a free upload-surface label (`profile-avatar`). Falls back to `general`. */
export function normalizeMemberMediaContext(raw: unknown): string {
  const value = String(raw ?? '').trim().toLowerCase()
  return CONTEXT_RE.test(value) ? value : 'general'
}

export function isMemberUploadMimeAllowed(mime: string): boolean {
  return (MEMBER_UPLOAD_MIME as readonly string[]).includes((mime || '').toLowerCase())
}

export async function recordMemberMedia(input: {
  userId: string
  mediaId: string
  context: string
}): Promise<void> {
  await db
    .insert(sfMediaOwners)
    .values({
      mediaId: input.mediaId,
      userId: input.userId,
      context: normalizeMemberMediaContext(input.context),
    })
    .onConflictDoNothing()
}

/** True when `mediaId` was uploaded by `userId` through the member path. */
export async function memberOwnsMedia(
  userId: string,
  mediaId: string,
): Promise<boolean> {
  const uid = userId.trim()
  const mid = mediaId.trim()
  if (!uid || !mid) return false
  const rows = await db
    .select({ mediaId: sfMediaOwners.mediaId })
    .from(sfMediaOwners)
    .where(and(eq(sfMediaOwners.userId, uid), eq(sfMediaOwners.mediaId, mid)))
    .limit(1)
  return rows.length > 0
}

/** A member's own uploads, newest first (resolved thumbnails). */
export async function listMemberMedia(
  userId: string,
  options?: { context?: string; limit?: number },
): Promise<ResolvedMedia[]> {
  const uid = userId.trim()
  if (!uid) return []
  const limit = Math.min(Math.max(options?.limit ?? 24, 1), 60)
  const context = options?.context
    ? normalizeMemberMediaContext(options.context)
    : ''

  const rows = await db
    .select({ mediaId: sfMediaOwners.mediaId })
    .from(sfMediaOwners)
    .where(
      context
        ? and(eq(sfMediaOwners.userId, uid), eq(sfMediaOwners.context, context))
        : eq(sfMediaOwners.userId, uid),
    )
    .orderBy(desc(sfMediaOwners.createdAt))
    .limit(limit)

  const resolved = await Promise.all(
    rows.map((row) =>
      resolveMediaById(row.mediaId, { size: 'thumbnail', preferWebp: true }),
    ),
  )
  return resolved.filter((m): m is ResolvedMedia => m != null)
}

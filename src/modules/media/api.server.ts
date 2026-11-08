/**
 * product:media server API — Payload resolve helpers.
 *
 * Import from Server Components / route handlers / actions only.
 * Client UI must use `@/modules/media/api` (picker + pure helpers) so the
 * minimal-flavor build does not pull `payload.config` into client graphs.
 *
 *   import { resolveMediaById } from '@/modules/media/api.server'
 */
import 'server-only'

export {
  findMediaById,
  listMedia,
  listMediaTagOptions,
  preferredMediaUrl,
  resolveMediaBind,
  resolveMediaById,
  toResolvedMedia,
} from '@/core/media/resolve'
export type { MediaSizeName, MediaTagOption, ResolvedMedia } from '@/core/media/resolve'

/** Member upload ledger — check ownership before storing a member-supplied `mediaId`. */
export {
  MEMBER_UPLOAD_MAX_BYTES,
  listMemberMedia,
  memberOwnsMedia,
} from './member'

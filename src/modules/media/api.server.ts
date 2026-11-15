/**
 * product:media server API — resolve helpers for the sf_media_* document store.
 *
 * Import from Server Components / route handlers / actions only.
 * Client UI must use `@/modules/media/api` (picker + pure helpers).
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

/** Pure frame helpers. Client UI keeps using `@/modules/media/api`. */
export {
  DEFAULT_IMAGE_FRAME,
  normalizeImageFrame,
  parseImageFrameJson,
  type ImageFrame,
} from './image-frame'

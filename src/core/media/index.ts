/**
 * Starforge media pipeline around Payload Media (SF-28 / SF-128).
 * One library; features bind by id. Storage port: local default, Spaces/S3 via env.
 */

export {
  MEDIA_CARD_WIDTH,
  MEDIA_FOLDERS,
  MEDIA_JPEG_QUALITY,
  MEDIA_LARGE_WIDTH,
  MEDIA_MAX_HEIGHT,
  MEDIA_MAX_WIDTH,
  MEDIA_PURPOSES,
  MEDIA_THUMB_SIZE,
  MEDIA_WEBP_QUALITY,
  isMediaFolder,
  isMediaPurpose,
  normalizeMediaFolder,
  normalizeMediaPurpose,
} from './pipeline'
export type { MediaFolder, MediaPurpose } from './pipeline'

export {
  findMediaById,
  listMedia,
  preferredMediaUrl,
  resolveMediaBind,
  resolveMediaById,
  toResolvedMedia,
} from './resolve'
export type { MediaSizeName, ResolvedMedia } from './resolve'

export { getMediaStorage, getMediaStorageInfo } from './storage'
export type { MediaStorage, MediaStorageInfo, MediaStorageKind } from './storage'

export {
  deleteMediaAction,
  listMediaAction,
  uploadMediaAction,
} from './actions'
export type { MediaActionState } from './actions'

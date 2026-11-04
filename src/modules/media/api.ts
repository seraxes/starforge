/**
 * product:media public API (design-module-boundary §6).
 *
 * Shared contract for Forms / Layout / future Events·Ads·Marketplace:
 * bind via `mediaId` + `MediaPicker` — do not fork a second library UI.
 *
 *   import { MediaPicker, resolveMediaById } from '@/modules/media/api'
 *
 * Ports stay in Core (`MediaStorage`, pipeline, analysis). Library admin UI
 * lives under `./admin` (M5).
 */

export { MediaPicker } from './admin/MediaPicker'
export type { MediaPickerValue } from './admin/MediaPicker'

export { MediaLightbox, mediaLightboxSrc } from './admin/MediaLightbox'
export { MediaCategoryTree } from './admin/MediaCategoryTree'

/** Resolve helpers — Core port surface re-exported for module consumers. */
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

export {
  flattenCategoryOptions,
  findCategoryInTree,
  type MediaCategoryNode,
} from '@/core/media/categories'

export {
  normalizeMediaPurposeFilter,
  parseMediaTagFilter,
  serializeMediaTagFilter,
  type MediaLibraryTagFilter,
  type MediaTagMatchMode,
} from '@/core/media/library-query'

/**
 * product:media public client API (design-module-boundary §6).
 *
 * Shared contract for Forms / Layout / future Events·Ads·Marketplace:
 * bind via `mediaId` + `MediaPicker` — do not fork a second library UI.
 *
 *   import { MediaPicker } from '@/modules/media/api'
 *   import { resolveMediaById } from '@/modules/media/api.server'
 *
 * Ports stay in Core (`MediaStorage`, pipeline, analysis). Library admin UI
 * lives under `./admin` (M5). Resolve helpers are server-only (`api.server.ts`)
 * so client barrels stay Payload-free for the minimal-flavor CI build.
 */

export { MediaPicker } from './admin/MediaPicker'
export type { MediaPickerValue } from './admin/MediaPicker'

/** Members (non-admins): upload / re-use *own* images — never the admin library. */
export { MemberMediaPicker } from './admin/MemberMediaPicker'
export type { MemberMediaPickerProps } from './admin/MemberMediaPicker'

/** Social-style pan/zoom crop — editor (client) + display frame. */
export { ImageFrameEditor } from './admin/ImageFrameEditor'
export type { ImageFrameEditorProps } from './admin/ImageFrameEditor'
export { FramedImage } from './admin/FramedImage'
export type { FramedImageProps } from './admin/FramedImage'
export {
  DEFAULT_IMAGE_FRAME,
  normalizeImageFrame,
  parseImageFrameJson,
  computeImageFrameLayout,
  imageFrameLayoutStyle,
  type ImageFrame,
  type ImageFrameShape,
} from './image-frame'

export { MediaLightbox, mediaLightboxSrc } from './admin/MediaLightbox'
export { MediaCategoryTree } from './admin/MediaCategoryTree'

/** Pure category helpers — safe in client components. */
export {
  flattenCategoryOptions,
  findCategoryInTree,
  type MediaCategoryNode,
} from '@/core/media/categories'

/** Pure library-query helpers — safe in client components. */
export {
  normalizeMediaPurposeFilter,
  parseMediaTagFilter,
  serializeMediaTagFilter,
  type MediaLibraryTagFilter,
  type MediaTagMatchMode,
} from '@/core/media/library-query'

/** Resolve result shape for picker previews (type-only; no Payload runtime). */
export type { MediaSizeName, MediaTagOption, ResolvedMedia } from '@/core/media/resolve'

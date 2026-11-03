/**
 * Starforge media pipeline around Payload Media (SF-28 / SF-128 / SF-148).
 * One library; features bind by id. Storage port: local default, Spaces/S3 via env.
 * Analysis port: thin OCR/AI hook stub (no vendor).
 */

export {
  DEFAULT_MEDIA_PIPELINE_RULES,
  MEDIA_CARD_WIDTH,
  MEDIA_FOLDERS,
  MEDIA_JPEG_QUALITY,
  MEDIA_LARGE_WIDTH,
  MEDIA_MAX_HEIGHT,
  MEDIA_MAX_WIDTH,
  MEDIA_PIPELINE_MAX_EDGE_MAX,
  MEDIA_PIPELINE_MAX_EDGE_MIN,
  MEDIA_PIPELINE_QUALITY_MAX,
  MEDIA_PIPELINE_QUALITY_MIN,
  MEDIA_PURPOSES,
  MEDIA_THUMB_SIZE,
  MEDIA_WEBP_QUALITY,
  isMediaFolder,
  isMediaPurpose,
  normalizeMediaFolder,
  normalizeMediaPipelineRules,
  normalizeMediaPurpose,
} from './pipeline'
export type { MediaFolder, MediaPipelineRules, MediaPurpose } from './pipeline'

export {
  STARFORGE_PIPELINE_APPLIED,
  applyMediaPipelineRules,
} from './apply-pipeline'
export type { ApplyMediaPipelineInput, ApplyMediaPipelineResult } from './apply-pipeline'

export {
  findMediaById,
  listMedia,
  listMediaTagOptions,
  preferredMediaUrl,
  resolveMediaBind,
  resolveMediaById,
  toResolvedMedia,
} from './resolve'
export type { MediaSizeName, MediaTagOption, ResolvedMedia } from './resolve'

export { getMediaStorage, getMediaStorageInfo } from './storage'
export type { MediaStorage, MediaStorageInfo, MediaStorageKind } from './storage'

export {
  createNoopMediaAnalysisPort,
  getMediaAnalysisPort,
} from './analysis'
export type {
  MediaAnalysisPort,
  MediaAnalysisResult,
  MediaAnalyzer,
  MediaAnalyzerInput,
} from './analysis'

// Form upload helpers live in `./form-upload` (server-only) — import that path
// directly from server actions / route handlers; do not barrel-export here.

export {
  deleteMediaAction,
  listMediaAction,
  listMediaTagOptionsAction,
  saveMediaPipelineSettingsAction,
  uploadMediaAction,
} from './actions'
export type { MediaActionState } from './actions'

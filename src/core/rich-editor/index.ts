/**
 * Rich editor engine (TipTap + sanitized HTML).
 *
 * Client UI: `@/modules/rich-editor/api` or `@/core/rich-editor/RichEditor`.
 * Server gate: `@/modules/rich-editor/api.server` (not this barrel — avoids
 * pulling settings/`next/headers` into Client Component graphs).
 */

export { RichContent } from './RichContent'
export { createRichEditorExtensions, SfImage } from './extensions'
export type { RichEditorPreset } from './extensions'
export { sanitizeRichHtml } from './sanitize'

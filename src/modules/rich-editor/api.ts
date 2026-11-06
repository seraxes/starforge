/**
 * Rich editor **client-safe** public API.
 *
 *   import { RichEditor, RichContent, sanitizeRichHtml } from '@/modules/rich-editor/api'
 *
 * Server-only gate (`isRichEditorEnabled`) → `@/modules/rich-editor/api.server`
 * (do not re-export it here — pulls `next/headers` into Client Components).
 */

export { RichContent } from '@/core/rich-editor/RichContent'
export { RichEditor } from '@/core/rich-editor/RichEditor'
export type { RichEditorProps } from '@/core/rich-editor/RichEditor'
export { sanitizeRichHtml } from '@/core/rich-editor/sanitize'
export type { RichEditorPreset } from '@/core/rich-editor/extensions'

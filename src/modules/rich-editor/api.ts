/**
 * Rich editor **client-safe** public API.
 *
 *   import { RichEditor, RichContent, sanitizeRichHtml, sanitizeEmailHtml } from '@/modules/rich-editor/api'
 *
 * Presets: `full` | `compact` | `email` (Email Manager HTML bodies).
 * Server-only gate (`isRichEditorEnabled`) → `@/modules/rich-editor/api.server`
 * (do not re-export it here — pulls `next/headers` into Client Components).
 */

export { RichContent } from '@/core/rich-editor/RichContent'
export { RichEditor } from '@/core/rich-editor/RichEditor'
export type { RichEditorProps } from '@/core/rich-editor/RichEditor'
export {
  sanitizeEmailHtml,
  sanitizeRichHtml,
} from '@/core/rich-editor/sanitize'
export type { SanitizeEmailHtmlOptions } from '@/core/rich-editor/sanitize'
export type { RichEditorPreset } from '@/core/rich-editor/extensions'

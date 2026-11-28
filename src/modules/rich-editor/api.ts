/**
 * Rich editor **client-safe** public API.
 *
 *   import { RichEditor, RichContent, sanitizeRichHtml, sanitizeEmailHtml } from '@/modules/rich-editor/api'
 *
 * Presets: `full` | `compact` | `email` (Email Manager HTML bodies).
 * Pass `MediaPicker` from `@/modules/media/api` for image, gallery, and video-from-media.
 * Emoji insert (text fields): `EmojiInsertButton`, `insertTextAtCaret`, `insertTextIntoValue`.
 * Server-only gate (`isRichEditorEnabled`) and server sanitize → `@/modules/rich-editor/api.server`
 * (do not re-export the gate here — pulls `next/headers` into Client Components).
 */

export { RichContent } from './RichContent'
export { RichEditor } from './RichEditor'
export type { RichEditorMediaPickerProps, RichEditorMediaValue, RichEditorProps } from './RichEditor'
export { EmojiInsertButton } from './EmojiInsertButton'
export type { EmojiInsertButtonProps } from './EmojiInsertButton'
export { insertTextAtCaret, insertTextIntoValue } from './insert-text-at-caret'
export type { InsertTextAtCaretResult, TextCaretTarget } from './insert-text-at-caret'
export {
  sanitizeEmailHtml,
  sanitizeRichHtml,
} from './sanitize'
export type { SanitizeEmailHtmlOptions } from './sanitize'
export type { RichEditorPreset } from './extensions'

import 'server-only'

/**
 * Rich editor server helpers.
 *
 *   import { isRichEditorEnabled, sanitizeRichHtml, sanitizeEmailHtml } from '@/modules/rich-editor/api.server'
 *
 * Sanitize lives here as well as on the client API so server saves do not load TipTap.
 * The Payload page-body hook imports `../sanitize` directly so collection config
 * does not pull Site Settings (that path loads the Payload config).
 */

export { isRichEditorEnabled, RICH_EDITOR_MODULE_ID } from './enabled'
export { sanitizeEmailHtml, sanitizeRichHtml } from './sanitize'
export type { SanitizeEmailHtmlOptions } from './sanitize'

/**
 * product:documents public door (client-safe surface).
 *
 *   import { DOCUMENTS_MODULE_ID, runDocumentsDoor } from '@/modules/documents/api'
 *
 * Server reads / writes (list, bind, render, send, webhook) stay on
 * `@/modules/documents/api.server`.
 */

export { DOCUMENTS_MODULE_ID } from './ids'
export { runDocumentsDoor } from './door'
export type { DocumentsDoorResult } from './door'

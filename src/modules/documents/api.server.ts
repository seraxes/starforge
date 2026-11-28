/**
 * product:documents server door.
 *
 *   import {
 *     DOCUMENTS_MODULE_ID,
 *     runDocumentsDoor,
 *     listDocumentLinks,
 *     bindDocumentMedia,
 *     renderDocumentTemplate,
 *     sendDocumentForSignature,
 *     applyDocumentSignatureWebhook,
 *   } from '@/modules/documents/api.server'
 *
 * When Documents is off, door helpers return `{ ok: false, reason: 'disabled' }`
 * and do not write. Authz failure on bind / render / send / webhook uses the
 * same reason.
 */

import 'server-only'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { runDocumentsDoor, type DocumentsDoorResult } from './door'
import type { BindDocumentMediaInput } from './links-rules'
import {
  bindDocumentMediaInStore,
  listDocumentLinksForSubject,
} from './links-store'
import type {
  BindDocumentMediaResult,
  DocumentLinkRecord,
  ListDocumentLinksInput,
} from './links'
import type { RenderDocumentTemplateInput } from './render-rules'
import type { RenderDocumentTemplateResult } from './render'
import { renderDocumentTemplateInStore } from './render-store'
import type {
  ApplyDocumentSignatureWebhookInput,
  SendDocumentForSignatureInput,
} from './signing-rules'
import type {
  ApplyDocumentSignatureWebhookResult,
  SendDocumentForSignatureResult,
} from './signing'
import {
  applyDocumentSignatureWebhookInStore,
  sendDocumentForSignatureInStore,
} from './signing-store'

export { DOCUMENTS_MODULE_ID } from './ids'
export { runDocumentsDoor } from './door'
export type { DocumentsDoorResult } from './door'
export type { BindDocumentMediaInput } from './links-rules'
export type {
  BindDocumentMediaResult,
  DocumentLinkRecord,
  ListDocumentLinksInput,
} from './links'
export type { RenderDocumentTemplateInput } from './render-rules'
export type { RenderDocumentTemplateResult } from './render'
export type {
  ApplyDocumentSignatureWebhookInput,
  SendDocumentForSignatureInput,
} from './signing-rules'
export type {
  ApplyDocumentSignatureWebhookResult,
  SendDocumentForSignatureResult,
} from './signing'
export {
  createDocumentLinksMemory,
  bindDocumentMediaThroughDoor,
  listDocumentLinksThroughDoor,
} from './links'
export {
  createDocumentRenderMemory,
  renderDocumentTemplateThroughDoor,
} from './render'
export {
  createDocumentSigningMemory,
  sendDocumentForSignatureThroughDoor,
  applyDocumentSignatureWebhookThroughDoor,
} from './signing'

async function documentsEnabled(): Promise<boolean> {
  const settings = await getSiteSettings()
  return isCatalogModuleEnabled(settings, MODULE_IDS.documents)
}

/** List document links for one subject. Pack off → disabled. */
export async function listDocumentLinks(
  input: ListDocumentLinksInput,
): Promise<DocumentsDoorResult<DocumentLinkRecord[]>> {
  return runDocumentsDoor(documentsEnabled, () => listDocumentLinksForSubject(input))
}

/**
 * Bind an existing mediaId onto a subject. Does not create file bytes.
 * Pack off, or `authorized: false`, → disabled and does not write.
 * Unknown subject kinds (e.g. `page`) are refused inside the door and do not write.
 */
export async function bindDocumentMedia(
  input: BindDocumentMediaInput & { authorized: boolean },
): Promise<DocumentsDoorResult<BindDocumentMediaResult>> {
  return runDocumentsDoor(
    async () => (await documentsEnabled()) && input.authorized,
    () => bindDocumentMediaInStore(input),
  )
}

/**
 * Render a template into Media and return the mediaId.
 * Caller passes merge values — does not read Onboarding, Fleet, or Forms tables.
 * Unique key: subject kind + subject id + template id + generation
 * (second render updates that generation when status is empty/draft/sent).
 * When status is signed, refuses and does not write.
 * Pack off, or `authorized: false`, → disabled and does not write.
 */
export async function renderDocumentTemplate(
  input: RenderDocumentTemplateInput & { authorized: boolean },
): Promise<DocumentsDoorResult<RenderDocumentTemplateResult>> {
  return runDocumentsDoor(
    async () => (await documentsEnabled()) && input.authorized,
    () => renderDocumentTemplateInStore(input),
  )
}

/**
 * Send the current generation for signature via the Core signature port.
 * Stores the envelope id and sets status `sent` on that link.
 * Pack off, or `authorized: false`, → disabled and does not write.
 */
export async function sendDocumentForSignature(
  input: SendDocumentForSignatureInput & { authorized: boolean },
): Promise<DocumentsDoorResult<SendDocumentForSignatureResult>> {
  return runDocumentsDoor(
    async () => (await documentsEnabled()) && input.authorized,
    () => sendDocumentForSignatureInStore(input),
  )
}

/**
 * Apply a signature webhook. Transaction keyed by provider event id.
 * On signed, stores the new Media id on that same link. Replay of the same
 * event id does not insert a second file.
 * Pack off, or `authorized: false`, → disabled and does not write.
 */
export async function applyDocumentSignatureWebhook(
  input: ApplyDocumentSignatureWebhookInput & { authorized: boolean },
): Promise<DocumentsDoorResult<ApplyDocumentSignatureWebhookResult>> {
  return runDocumentsDoor(
    async () => (await documentsEnabled()) && input.authorized,
    () => applyDocumentSignatureWebhookInStore(input),
  )
}

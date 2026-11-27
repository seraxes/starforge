# product:documents

Layer: advanced

Class: advanced — domain product. Hard `requires`: Media. Does not `require` Onboarding or Fleet. `defaultEnabled: false`.

Status: slice 5 (signing) in tree. Design: [documents-pack-plan](../../../docs/project-context/docs/documents-pack-plan.md). Coding slices: [documents-build-spec](../../../docs/project-context/docs/documents-build-spec.md). Signing: [2026-11-27-documents-signing](../../../docs/project-context/docs/decisions/2026-11-27-documents-signing.md).

## Owns

- Fail-closed door (`runDocumentsDoor`)
- Subject **links** (`sf_documents_links`): subject kind + id, optional template id, `mediaId`, title, status, provider id, envelope id, generation, created at / by
- Subject binding for `user`, `onboarding`, and `fleet_vehicle`
- Shared list / bind / render / send / webhook door
- Document **templates** (`sf_documents_templates`): id, title, subject kind, render source, enabled, created at, updated at (PDF bytes are not on this row)
- Signature webhook receipts (`sf_documents_signature_receipts`) keyed by provider + event id
- Staff admin `/admin/documents` (templates + subject links filter)
- Contract envelope status and the signed file’s `mediaId`

**Rule of thumb:** Media keeps the file. Documents keeps the template and the subject link. Invoices stay in Payments. Valid-until stays in Onboarding. Form fields stay in Forms. Signature HTTP stays in the Core signature port.

## Consumes

- **media** — bytes always; this pack stores `mediaId`. No documents library.
- **Core ACL** — `admin.documents` (view / edit / manage). Staff: `viewer.isAppAdmin` or `viewerMayAccessAdminResource(viewer, 'admin.documents', 'edit')`. App admin bypasses (`sf-staff-bypass`).
- **Core signature port** — `src/core/signatures/<id>.ts` registered from `register-online.ts` (DocuSign first). Site secrets in the env overlay.
- Callers: **onboarding**, **fleet** (via this public door only)
- **email-manager** if this pack sends its own mail (`emitEmailTrigger`)

## Public door

`@/modules/documents/api` and `@/modules/documents/api.server`. Door ids: `documents-api`, `documents-api-server`.

Exports: `runDocumentsDoor`; on `api.server` also `listDocumentLinks`, `bindDocumentMedia`, `renderDocumentTemplate`, `sendDocumentForSignature`, and `applyDocumentSignatureWebhook`. Pack off, or authz failure, → `{ ok: false, reason: 'disabled' }` and no write. Unknown subject kinds (e.g. `page`) are refused and do not write. Render does not read Onboarding, Fleet, or Forms tables — the caller passes merge values.

Unique key with a template id: subject kind + subject id + template id + generation (defaults to 1). While status is empty, `draft`, or `sent`, render updates that generation. When status is `signed`, render refuses and does not write. Void keeps that generation; the next contract is generation + 1 (a new link).

`sendDocumentForSignature` stores the envelope id and sets status `sent`. `applyDocumentSignatureWebhook` runs in a transaction keyed by the provider event id; on `signed` it stores the new Media id on that same link. A replay does not insert a second file.

## Admin surfaces

- `/admin/documents` — templates (create / edit; controlled selects) and optional subject links via `?subjectKind=&subjectId=`
- ACL area `documents` → `admin.documents`
- Onboarding person card deep-links here for that onboarding subject when Documents is on
- Post-save stays on `/admin/documents`

## Boot and jobs

None. Signature adapters boot when `@/core/signatures` (or `register-online`) is imported.

## Schema

`sf_documents_links`, `sf_documents_templates`, and `sf_documents_signature_receipts` in this pack’s `schema.ts` only. Plain text subject / media / template / envelope / event ids. No foreign keys to other packs. No file bytes.

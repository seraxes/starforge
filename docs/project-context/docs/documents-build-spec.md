---
kind: reference
last_verified: 2026-11-27
---
# product:documents — build spec

**Status:** Spec only. **Parked.** Do not scaffold `src/modules/documents`, schema, admin UI, or a manifest from this file. Do not unpark the pack. Do not start Onboarding slice 6. Fleet stays parked. Implementation waits until a person file and a car file need the same renderer. Live map: [architecture-current](./architecture-current.md).  
**Pack plan:** [documents-pack-plan](./documents-pack-plan.md). **Family order:** [primeone-pack-plans](./primeone-pack-plans.md) wave **9** only.  
**Coverage:** [primeone-coverage-plan](./primeone-coverage-plan.md).  
**Signing:** Slice 5 of this pack. Decision: [2026-11-27-documents-signing](./decisions/2026-11-27-documents-signing.md).

## How to run a slice

One slice per chat. Stop when its checks pass. Do not start the next slice in the same chat. Do not start slice 1 until the live map takes Documents off the parked line.

Every slice, once a build is allowed:

1. Copy the nearest finished pack’s door (`runOnboardingDoor` / `runMarketplaceDoor`). Admin chrome is Events / Page Settings. Selects on a `useActionState` form are controlled or remounted.
2. Cross-pack calls go through `@/modules/<id>/api` or `api.server`. Do not import another pack’s `schema`, `store`, or `actions`. Do not add a row to `scripts/module-boundary-allowlist.json`.
3. Register the new unit file on the `test:unit` script in `package.json`. Each slice below names one success test and one failure test.
4. Manifest, schema, or public-door edits: `npm run modules:generate` if the manifest changed, then `npm run check:atomic`. Do not hand-edit `src/generated`.
5. Schema edits: `npm run db:migrate`. Tables are `sf_documents_*` in this pack’s `schema.ts` only. Subject ids and `mediaId` are plain text. No foreign keys to other packs. Owner-module `ADD COLUMN` only.
6. `npm run lint` must pass. An admin slice is not done until `/admin/documents` has been saved in the browser and the control still shows the saved value.

**Done when:** the slice’s success test and failure test are registered in `test:unit`, `npm run lint` passes, `npm run check:atomic` passes when the manifest, schema, or door changed, and `npm run db:migrate` has been run on a schema slice.

## Shared rules

- Joomla stays the system of record until a caller’s reconcile passes. This pack does not import a parallel file library.
- Media owns bytes. This pack stores the template and the subject link (`mediaId`).
- Invoices and fiscal receipts stay in Payments. They are not subjects here.
- Form field schemas stay in Forms. The render caller passes merge values. This pack does not read Forms, Onboarding, or Fleet tables.
- Valid-until on licence, health booklet, and contract stays in Onboarding (`sf_onboarding_document_slots`).
- Core ACL only. Staff bypass stays additive ([sf-staff-bypass](../../../.cursor/rules/sf-staff-bypass.mdc)).
- Pack off, or authz failure, returns `{ ok: false, reason: 'disabled' }` and does not write.
- `defaultEnabled: false` until a site turns the pack on.

## Door

`@/modules/documents/api` and `@/modules/documents/api.server`. Door id: `documents-api`.

`runDocumentsDoor(isEnabled, work)` matches the Onboarding door. Off → `{ ok: false, reason: 'disabled' }` and `work` is not called.

Operations, named here so later slices do not invent a second door:

| Export | Slice | Behavior |
| --- | --- | --- |
| `listDocumentLinks({ subjectKind, subjectId })` | 2 | Links for that one subject |
| `bindDocumentMedia({ subjectKind, subjectId, templateId?, mediaId, title, createdBy })` | 2 | Stores an existing `mediaId`. Does not create file bytes |
| `renderDocumentTemplate({ subjectKind, subjectId, templateId, title, createdBy, values })` | 3 | Renders into Media and returns the `mediaId` |
| `sendDocumentForSignature` | 5 | Calls the Core signature port. Stores the envelope id and status on the current link |
| `applyDocumentSignatureWebhook` | 5 | Idempotent. Updates that link’s `mediaId` and status |

List, bind, render, send, and webhook are server exports (`api.server`). `api` re-exports `runDocumentsDoor` when that file stays free of `server-only` imports.

Hard `requires` when scaffolded: Media. `layer: advanced`. `defaultEnabled: false`. This pack does not `require` Onboarding or Fleet.

**Unique key** for a link that has a template id: subject kind + subject id + template id. A second render updates that link and does not insert a second file. A bind with a template id uses the same key. A bind with no template id keeps that `mediaId` on the subject; the same `mediaId` updates that link.

An unknown subject kind is refused and does not write. Allowed kinds are `user`, `onboarding`, and `fleet_vehicle`.

## Tables (future — do not create in this docs slice)

Declared only in this pack’s `schema.ts`.

| Table | Slice | Columns |
| --- | --- | --- |
| `sf_documents_links` | 2 | Subject kind, subject id, optional template id, `mediaId`, title, created at, created by. Plain text ids. No file bytes |
| `sf_documents_templates` | 3 | Staff-edited: id, title, subject kind, render source, enabled, created at, updated at. The PDF is not stored on this row |
| Link columns | 5 | `ADD COLUMN` for status (`draft` \| `sent` \| `signed` \| `declined` \| `void`), provider id, envelope id, generation. Unique key becomes subject kind + subject id + template id + generation. Generation defaults to 1 |

Webhook receipt id lives in `sf_documents_*` so a replay can see it. No foreign keys.

## Slices (one chat each, when unparked)

### 1. Scaffold

Manifest (`layer: advanced`, `defaultEnabled: false`), hard `requires`: Media. `runDocumentsDoor`, `api.ts`, `api.server.ts`, README Owns/Consumes, registry generate. No tables. No admin route. No bind, render, or signing exports yet.

**Success test:** the door is enabled, `work` runs, and the result comes back.  
**Failure test:** the pack is off, the result is `{ ok: false, reason: 'disabled' }`, and `work` is not called.

**Done when:** that file is on `test:unit`, `npm run lint`, `npm run check:atomic`.

### 2. Bind and list

`sf_documents_links` only. Subjects `user`, `onboarding`, `fleet_vehicle`. `listDocumentLinks` and `bindDocumentMedia`.

**Success test:** bind `media-1` on (`onboarding`, `report-1`); list for that subject returns that link and that `mediaId`.  
**Failure test:** pack off, or authz failure, returns `disabled` and does not write. The same test refuses subject kind `page` and does not write. List for (`onboarding`, `report-2`) does not include `media-1`.

**Done when:** those tests are on `test:unit`, lint, `check:atomic`, `db:migrate`.

### 3. Template render

`sf_documents_templates`. `renderDocumentTemplate` writes the PDF through Media and returns the `mediaId`.

**Success test:** render for (`onboarding`, `report-1`, template `training-report`) returns a `mediaId` and one link. A second render updates that link’s `mediaId` and does not insert a second file.  
**Failure test:** pack off, or authz failure, returns `disabled` and does not write.

**Done when:** those tests are on `test:unit`, lint, `check:atomic`, `db:migrate`.

### 4. Admin

`/admin/documents`. Manifest `admin.routes`. ACL area `documents` → `admin.documents`. Staff check: `viewer.isAppAdmin` or `viewerMayAccessAdminResource(viewer, 'admin.documents', 'edit')`. App admin bypasses.

The Onboarding person card deep-links to `/admin/documents` for that onboarding subject. Post-save stays on `/admin/documents`.

**Success test:** an app admin, and a viewer with `admin.documents` edit, pass the staff check.  
**Failure test:** a viewer who is neither is refused.

**Done when:** those tests are on `test:unit`, lint, `check:atomic` (the manifest route changes). In the browser, save a template field and confirm the control still shows the saved value.

### 5. Signing

After slices 1–4. Same park as the rest of this pack. Decision: [2026-11-27-documents-signing](./decisions/2026-11-27-documents-signing.md).

Add the link columns in the table above. Add `src/core/signatures/<id>.ts` and register it the way `src/core/payments/<id>.ts` is registered. DocuSign is the first adapter. The port’s operations are create envelope, read status, and download the signed PDF. Another provider is another file. An admin does not upload a provider.

`sendDocumentForSignature` stores the envelope id and sets status `sent` on the current generation. `applyDocumentSignatureWebhook` runs in a transaction, keyed by the provider event id. On `signed`, it stores the new Media id on that same link.

While status is empty, `draft`, or `sent`, render still updates that generation. When status is `signed`, render refuses and does not write. Void keeps that generation. The next contract is generation + 1, a new link.

Onboarding may store the returned `mediaId` on the contract slot (`kind: contract`). `validUntil` stays on that slot.

Provider secrets for this one site stay in the env overlay.

**Success test:** a signed webhook sets status `signed` and the new `mediaId` on the existing link; the same event id does not insert a second file.  
**Failure test:** render on a `signed` link leaves that `mediaId` in place and does not write. Pack off, or authz failure, returns `disabled` and does not write.

**Done when:** those tests are on `test:unit`, lint, `check:atomic`, `db:migrate`.

## Callers

### Onboarding training PDF (slice 6 — do not start here)

Onboarding calls `renderDocumentTemplate` when this pack is on:

| Input | Value |
| --- | --- |
| Subject kind | `onboarding` |
| Subject id | Training report id |
| Template id | The training-report template |
| Values | The report fields Onboarding already has |

On success, Onboarding stores the returned `mediaId` on `sf_onboarding_training_reports.mediaId`.

When Documents is off, Onboarding keeps `renderTrainingReportPdf` and Media ingest. The report still stores one `mediaId`.

When the door returns `disabled` because authz failed, Onboarding leaves the report’s `mediaId` unchanged and does not render a pack-local PDF for that attempt.

Licence, health booklet, and contract stay on `sf_onboarding_document_slots` (`driving_licence`, `health_booklet`, `contract`) with `mediaId` and `validUntil`. Slice 6 does not move those rows.

### Fleet vehicle file (later — do not design Fleet)

A future Fleet slice calls this same door with subject kind `fleet_vehicle` and the vehicle id as subject id. Bind for a scan that already exists in Media. Render for a template. This file does not define Fleet tables, shifts, or admin.

## What does not move here

| Item | Owner |
| --- | --- |
| Form field schemas | Forms |
| Slot workflow and valid-until | Onboarding |
| Shift, fault, and inspection checklist state | Fleet |
| Invoice PDF | Payments |
| Signature provider HTTP and webhook verify | Core signature port. This pack stores the envelope id and the status |
| Driver home / Coming up / Analytics pages | Pages — they link to files; they do not store them |

## Gaps

| Gap | Disposition |
| --- | --- |
| Live training PDF | Stays in Onboarding until this pack’s slice 3 is on and Onboarding slice 6 calls the door. Pack-local PDF remains while Documents is off |
| Live vehicle registration / insurance paths | Media ids on the car until a future Fleet slice calls this door |
| Valid-until dates | Onboarding. This pack does not own expiry |
| Contract signing | Slice 5 of this pack, after render. Not a separate module |
| Documents list page | A page of links. Not a second store |
| Other subjects | Out. Allowed kinds are `user`, `onboarding`, and `fleet_vehicle` |

## Related

- Pack plan: [documents-pack-plan](./documents-pack-plan.md)
- Signing decision: [2026-11-27-documents-signing](./decisions/2026-11-27-documents-signing.md)
- Person files: [onboarding-build-spec](./onboarding-build-spec.md)
- Vehicle files: [fleet-build-spec](./fleet-build-spec.md)
- Family index: [primeone-pack-plans](./primeone-pack-plans.md)
- Live map: [architecture-current](./architecture-current.md)

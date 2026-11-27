---
kind: reference
last_verified: 2026-11-27
---
# product:documents — pack plan

**Status:** Proposed. **Parked.** Implementation waits until a person file and a car file need the same renderer. Do not scaffold `src/modules/documents`, a manifest, schema, admin UI, or a migration from this plan. Do not unpark the pack. Do not start Onboarding slice 6. Fleet stays parked. Live map: [architecture-current](./architecture-current.md).  
**Placement:** Advanced module (`product:documents`). Shared pack. Not Core. Not base. Not Hero. `defaultEnabled: false` until a site turns the pack on.  
**Family index:** [primeone-pack-plans](./primeone-pack-plans.md).  
**Signing:** A later slice of this pack. Decision: [2026-11-27-documents-signing](./decisions/2026-11-27-documents-signing.md).  
**Principle:** Never rebuild an existing module’s job ([modular-core](../principles/modular-core.md), [sf-module-ownership](../../../.cursor/rules/sf-module-ownership.mdc), [sf-architecture](../../../.cursor/rules/sf-architecture.mdc)).

## What this pack is

Media keeps the file bytes. Documents keeps the template and the link that says which file belongs to which person or car. Onboarding and Fleet call this door. Neither pack grows its own PDF maker once this pack is on.

A contract someone signs online is that same link. The signature service is a Core adapter. This pack stores the envelope status and the signed file’s `mediaId`. There is no separate contracts module.

## Ownership (planned)

| Owns | Consumes |
| --- | --- |
| Document **template** (fields staff edit) and the **link** from a rendered or bound file to a subject | **media** (bytes always; this pack stores `mediaId`) |
| Subject binding for `user`, `onboarding`, and `fleet_vehicle` | **Core ACL** (`admin.documents`; staff bypass additive) |
| Shared list / bind / render door | Callers: **onboarding**, **fleet** (via this public door only) |
| Contract envelope status and the signed file’s `mediaId` (slice 5) | **Core signature port** (one adapter per provider). **email-manager** if this pack sends its own mail (`emitEmailTrigger`) |

**Rule of thumb:** Media keeps the file. Documents keeps the template and the subject link. Invoices stay in Payments. Valid-until stays in Onboarding. Form fields stay in Forms.

## Public door (planned)

`@/modules/documents/api` and `@/modules/documents/api.server` when the call touches the database or Media. Door id: `documents-api`.

Exports for slices 1–4:

- List links for one subject (subject kind + subject id).
- Bind an existing `mediaId` onto a subject.
- Render a template into Media and return the `mediaId`.

The caller passes the merge values. This pack does not read Onboarding, Fleet, or Forms tables.

**Unique key:** subject kind + subject id + template id. A second render of that key updates that one link. It does not insert a second file. A bind that includes a template id uses the same key. A bind with no template id stores that `mediaId` on the subject; binding the same `mediaId` again updates that link.

**Pack off, or authz failure,** returns `disabled` and does not write.

Slice 5 adds send-for-signature and apply-webhook on this same door. Those exports do not exist in slices 1–4.

Cross-pack callers use this door only. Private `store` / `schema` / `actions` stay inside the pack.

Hard `requires` when scaffolded: Media. This pack does not `require` Onboarding or Fleet. `layer: advanced`. `defaultEnabled: false`.

## Subjects

| Subject | Examples |
| --- | --- |
| `user` | A file that belongs to the person |
| `onboarding` | Training PDF. The training report id is the subject id |
| `fleet_vehicle` | Registration, insurance, inspection sheet. The vehicle id is the subject id |

No other subjects. An invoice, a page, or a form is not a subject here.

## Fields (planned)

Future tables are `sf_documents_*` in this pack’s schema only. Subject ids and `mediaId` are plain text. No foreign keys to other packs. No file bytes on the row.

| Record | Fields |
| --- | --- |
| Template | Fields staff edit: id, title, subject kind, render source, enabled, created at, updated at. The rendered PDF is not stored on this row |
| Link | Subject kind, subject id, optional template id, `mediaId`, title, created at, created by |

Slice 5 adds status, provider id, envelope id, and generation on the link. Those columns are absent in slices 1–4.

## Onboarding slice 6 (do not start in this plan)

When Documents is on, the training PDF goes through this door:

- Subject kind `onboarding`.
- Subject id is the training report id (`sf_onboarding_training_reports`).
- Template id is the training-report template.
- Render returns a `mediaId`. Onboarding stores that id on the report, where the pack-local PDF’s id already sits.

When Documents is off, the pack-local PDF stays. Onboarding keeps `renderTrainingReportPdf`, sends the bytes to Media, and stores that `mediaId` on the report.

When the door returns `disabled` because authz failed, Onboarding leaves the report’s `mediaId` unchanged and does not write a pack-local PDF for that attempt.

Licence, health booklet, and contract stay Onboarding slots (`driving_licence`, `health_booklet`, `contract`): `mediaId` plus valid-until. Slice 6 does not move them. Slice 5 may hand back a signed `mediaId` for the contract slot. The valid-until date stays on the slot. Answers stay in Forms.

Person card: a deep link to `/admin/documents` for that onboarding subject. The admin page is this pack’s slice 4.

## Fleet (do not design Fleet)

A future vehicle file calls this same door. Subject kind `fleet_vehicle`. Subject id is the vehicle id (plain text). Bind an existing scan, or render a template. Fleet does not grow a second PDF maker. This plan does not define Fleet tables, shifts, stations, or admin.

Until this pack exists, Fleet stores vehicle files as Media ids on the car.

## Signing (slice 5 — still parked)

Online contracts and signing stay in this pack. Decision: [2026-11-27-documents-signing](./decisions/2026-11-27-documents-signing.md).

- Staff keep the contract template here. Forms still holds the answers. The caller passes those values into render.
- Send-for-signature calls the Core signature port. The port returns an envelope id. This pack stores it on the link with status `draft`, `sent`, `signed`, `declined`, or `void`.
- A provider webhook is idempotent and runs in a transaction. The signed PDF goes to Media. The same link’s `mediaId` updates. A replay does not insert a second file.
- While status is empty, `draft`, or `sent`, a second render updates that one link.
- When status is `signed`, render refuses and does not write. The signed file stays.
- Replacing a signed contract is void on that generation, then a new generation (a new link). The signed generation stays in the list.
- Provider secrets for the one site stay in the env overlay. A developer adds `src/core/signatures/<id>.ts` and registers it. An admin enables the provider and pastes keys. DocuSign is the first adapter shape. Another provider is another adapter file.
- The provider can email the signer. Mail this product sends itself goes through Email Manager.

## Until this pack exists

- Onboarding renders the training PDF itself.
- Fleet stores vehicle files as Media ids on the car.
- A site “Documents list” page may link to files the packs already produce. It is a page of links, not a second store.
- The contract slot stays an upload plus a valid-until date on the person.

## Admin surfaces and ACL (planned)

| Surface | Path / key |
| --- | --- |
| Pack admin | `/admin/documents` (templates, subject links, settings) |
| ACL area | `documents` → `admin.documents`. One grant for Documents |
| Staff | `viewer.isAppAdmin` or `viewerMayAccessAdminResource(viewer, 'admin.documents', 'edit')`. App admin bypasses |
| Deep link | Onboarding person card → `/admin/documents` for that subject |

## Slice order (when unparked)

One slice per chat. Stop when that slice’s checks pass. Coding order and tests: [documents-build-spec](./documents-build-spec.md).

1. **Scaffold** — manifest (`layer: advanced`, `defaultEnabled: false`), hard `requires`: Media; door; README Owns/Consumes; registry generate. No tables.
2. **Bind and list** — `user` / `onboarding` / `fleet_vehicle`. Media ids only.
3. **Template render** — render into Media; second render updates the one link.
4. **Admin** — `/admin/documents` and the person-card deep link.
5. **Signing** — Core signature port, envelope status, webhook. After slices 1–4. Still waits on the same park: a person file and a car file must both need the renderer before any of these slices start.

## Explicit non-goals

| Out | Why |
| --- | --- |
| File bytes / library | `product:media` |
| Invoices and fiscal receipts | `product:payments` |
| Form field schemas | `product:forms` |
| Valid-until on licence, health booklet, contract | Onboarding |
| A `product:signatures` or `product:contracts` pack | This pack owns the contract link and the envelope |
| Subjects other than `user`, `onboarding`, `fleet_vehicle` | MVP list |
| Fleet tables, shifts, or admin | Fleet’s own plan, when that pack is unparked |
| Starting ahead of a person file and a car file that need the same renderer | Live map |

## Related

- Build spec (parked): [documents-build-spec](./documents-build-spec.md)
- Signing decision: [2026-11-27-documents-signing](./decisions/2026-11-27-documents-signing.md)
- Family index: [primeone-pack-plans](./primeone-pack-plans.md)
- Onboarding: [onboarding-pack-plan](./onboarding-pack-plan.md), [onboarding-build-spec](./onboarding-build-spec.md)
- Fleet: [fleet-pack-plan](./fleet-pack-plan.md), [fleet-build-spec](./fleet-build-spec.md)
- Live map: [architecture-current](./architecture-current.md)
- Layers: [platform-module-layers](./platform-module-layers.md)
- Staff bypass: [sf-staff-bypass](../../../.cursor/rules/sf-staff-bypass.mdc)

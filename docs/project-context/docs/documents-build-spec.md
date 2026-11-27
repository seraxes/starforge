---
kind: reference
last_verified: 2026-11-27
---
# product:documents — build spec

**Status:** Spec only. **Parked.** Do not scaffold `src/modules/documents`, schema, admin UI, or a manifest from this file. Onboarding may proceed; Documents stays parked. Live map: [architecture-current](./architecture-current.md).  
**Pack plan:** [documents-pack-plan](./documents-pack-plan.md). **Family order:** [primeone-pack-plans](./primeone-pack-plans.md) wave **9** only.  
**Coverage:** [primeone-coverage-plan](./primeone-coverage-plan.md).

Do not implement this pack until both a person file and a car file need the same renderer. Until then, Onboarding renders the training PDF itself and Fleet stores vehicle files as Media ids on the car.

## Shared rules

- Joomla stays the system of record until a caller’s reconcile passes. This pack does not import a parallel file library.
- Media owns bytes. This pack stores the template and the subject link (`mediaId`).
- Invoices and fiscal receipts stay in Payments. They are not subjects here.
- No second PDF engine inside Onboarding or Fleet once slice 3 is on.
- Core ACL only. Staff bypass stays additive ([sf-staff-bypass](../../../.cursor/rules/sf-staff-bypass.mdc)).

## Door (name only — scaffold later)

`@/modules/documents/api`. Door id: `documents-api`.

Exports to freeze at scaffold: bind and list documents for a subject; render a template into Media or attach an existing `mediaId`; template catalog for staff.

Hard `requires` when scaffolded: Media. `layer: advanced`. Callers: Onboarding and Fleet, through this door only.

## Slices (one chat each, when unparked)

| # | Slice | Family wave | Done when |
| --- | --- | --- | --- |
| 1 | Scaffold: manifest, empty door, README Owns/Consumes, registry generate. No tables. | 9 | `check:atomic` if the manifest/door lands |
| 2 | Bind and list. Subjects: `user`, `onboarding`, `fleet_vehicle`. Media ids only. | 9 | A list for one subject returns only that subject’s links |
| 3 | Template render into Media. Onboarding training PDF and Fleet vehicle packs call this door. | 9 | Onboarding slice 6 and Fleet vehicle files stop using a private renderer |
| 4 | Admin `/admin/documents` and ACL `admin.documents`. | 9 | Deep links from the person card and the vehicle card |

## Subjects

| Subject | Examples | Until this pack |
| --- | --- | --- |
| `user` | A file that belongs to the person | Core user + Media id |
| `onboarding` | Application pack, training PDF, licence, health booklet | Onboarding slots + pack-local training PDF |
| `fleet_vehicle` | Registration (forgalmi), insurance, inspection sheet | Media ids on the Fleet vehicle |

Decision-level link fields: subject kind, subject id, template id (optional), `mediaId`, title, created at, created by. No file bytes on the row.

## What does not move here

| Item | Owner |
| --- | --- |
| Form field schemas | Forms |
| Slot workflow and valid-until | Onboarding |
| Shift, fault, and inspection checklist state | Fleet |
| Invoice PDF | Payments |
| Driver home / Coming up / Analytics pages | Pages — they link to files; they do not store them |

## Gaps

| Gap | Disposition |
| --- | --- |
| Live training PDF | Stays in Onboarding until slice 3, then this door. |
| Live vehicle registration / insurance paths | Media ids on the car until slice 3, then a `fleet_vehicle` link. |
| Valid-until dates | Onboarding slice 5. This pack does not own expiry. |
| Documents list page | A page of links. Not a second store. |
| General CRM attachments for every entity | Out. MVP subjects are user, onboarding, and fleet vehicle. |

## Related

- Pack plan: [documents-pack-plan](./documents-pack-plan.md)
- Person files: [onboarding-build-spec](./onboarding-build-spec.md)
- Vehicle files: [fleet-build-spec](./fleet-build-spec.md)
- Family index: [primeone-pack-plans](./primeone-pack-plans.md)
- Live map: [architecture-current](./architecture-current.md)

---
kind: reference
last_verified: 2026-11-26
---
# product:documents — pack plan

**Status:** Proposed. **Parked** — not on the live queue (Social polish, then Marketplace first). Live map: [architecture-current](./architecture-current.md). Do not scaffold schema, admin UI, or a manifest from this plan. Build when both a person file and a car file need the same renderer.  
**Placement:** Advanced module (`product:documents`). Shared pack. Not Core. Not base. Not Hero.  
**Family index:** [primeone-pack-plans](./primeone-pack-plans.md).  
**Principle:** Never rebuild an existing module’s job ([modular-core](../principles/modular-core.md), [sf-module-ownership](../../../.cursor/rules/sf-module-ownership.mdc), [sf-architecture](../../../.cursor/rules/sf-architecture.mdc)).

## Ownership (planned)

| Owns | Consumes |
| --- | --- |
| Document **template** and the **link** from a rendered/bound file to a subject | **media** (bytes always; packs store `mediaId`) |
| Subject binding for Core user, onboarding record, and fleet vehicle | **Core ACL** (`admin.documents`; staff bypass additive) |
| Shared render / list door used by Onboarding and Fleet | Callers: **onboarding**, **fleet** (via this public door only) |

**Rule of thumb:** Media keeps the file. Documents keeps the template and the subject link. Neither Onboarding nor Fleet grows its own PDF library once this pack exists. **Invoices stay in Payments.**

## Public door (planned)

`@/modules/documents/api` (and `api.server` if needed). Door id: `documents-api`.

Planned exports (names indicative; freeze in the scaffold slice):

- Bind / list documents for a subject (`user` | `onboarding` | `fleet_vehicle` + id)
- Render from a template into Media (or attach an existing `mediaId`)
- Settings / template catalog for staff

Cross-pack callers use this door only. Private `store` / `schema` / `actions` stay inside the pack.

## Subject map

| Subject | Examples |
| --- | --- |
| Core user | A file that belongs to the person |
| Onboarding | Application pack, training PDF, licence, health booklet |
| Fleet vehicle | Forgalmi, insurance, inspection sheet |

## Until this pack exists

- Onboarding renders the training PDF itself.
- Fleet stores vehicle files as Media ids on the car.
- A site “Documents list” page may link to files the packs already produce — it is not a second store.

## Admin surfaces and ACL (planned)

| Surface | Path / key |
| --- | --- |
| Pack admin | `/admin/documents` (templates, subject links, settings) |
| ACL area | `documents` → `admin.documents` (view / edit / manage). One grant for Documents. App admin bypasses. |

## Slice order (when unparked)

One slice per chat. Stop when that slice’s checks pass. **Do not start schema or admin UI in the plan-only chat.**

1. **Scaffold** — manifest (`layer: advanced`), hard `requires`: Media; empty public door; README Owns/Consumes; registry generate.
2. **Subject bind + list** — user / onboarding / vehicle; Media ids only.
3. **Template render** — shared PDF (or equivalent) path; Onboarding training PDF and Fleet vehicle packs call this door.
4. **Admin chrome + ACL** — `/admin/documents`; deep-links from Onboarding / Fleet person and vehicle cards.

## Explicit non-goals

| Out | Why |
| --- | --- |
| File bytes / library | `product:media` |
| Invoices, receipts as fiscal docs | `product:payments` |
| Parallel PDF engines inside Onboarding or Fleet | This pack owns the shared renderer |
| General CRM attachments for every entity | Subjects are user, onboarding, fleet vehicle for MVP |
| Starting ahead of Social → Marketplace, or before Onboarding + Fleet need it | Live map + family build order |

## Related

- Build spec (parked): [documents-build-spec](./documents-build-spec.md)
- Family index: [primeone-pack-plans](./primeone-pack-plans.md)
- Onboarding: [onboarding-pack-plan](./onboarding-pack-plan.md)
- Fleet: [fleet-pack-plan](./fleet-pack-plan.md)
- Live map: [architecture-current](./architecture-current.md)
- Layers: [platform-module-layers](./platform-module-layers.md)

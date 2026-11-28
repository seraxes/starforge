---
kind: reference
last_verified: 2026-11-28
---
# product:scan — pack plan

**Status:** Proposed. **Parked.** Do not scaffold `src/modules/scan`, a manifest, a Python service, a Forms `read` block, or an Onboarding seed from this plan. Do not unpark the pack. Live map: [architecture-current](./architecture-current.md).  
**Placement:** Advanced module (`product:scan`). Shared pack. Not Core. Not base. Not Hero. `layer: advanced`. `defaultEnabled: false`. Hard `requires`: Media. Does not `require` Forms, Documents, or Onboarding.  
**Layers note:** [platform-module-layers](./platform-module-layers.md) still files “OCR apps” as Hero on `MediaAnalysisPort`. That row stays until a decision accepts this plan. This pack is the generic reader (any form, any card). Card labels for one company stay on that form definition.  
**Principle:** Never rebuild an existing module’s job ([modular-core](../principles/modular-core.md), [sf-module-ownership](../../../.cursor/rules/sf-module-ownership.mdc), [sf-architecture](../../../.cursor/rules/sf-architecture.mdc), [sf-forms-module](../../../.cursor/rules/sf-forms-module.mdc)).

## What this pack is

A person uploads a photo of a card or a stamp. The photo is already a Media file. This pack finds the border, straightens it, reads the printed lines (and a QR when one is present), and applies a zone / label map the caller passes in. Forms stores that map on the file field and fills the other inputs. The person can edit the filled values before submit.

`product:documents` keeps templates and subject links. It does not read pixels. Media keeps the bytes. Onboarding keeps `validUntil` on its document slots. The extracted date is a Forms value the slot already stores.

## Ownership (planned)

| Owns | Consumes |
| --- | --- |
| Border find, warp, line boxes, QR decode | **media** — bytes stay there; the door receives a `mediaId` or a buffer the caller already accepted |
| Pure map from lines → field values (zone, label prefix, pattern, QR) | **Core `MediaAnalysisPort`** — stays the library hook. This pack does not replace it and does not join the library “Analyze” allowlist |
| Local reader process and its HTTP client | **Core env** — service URL and bearer token. Not a database column |
| Fail-closed door | **Core RateLimiter** — Forms calls it on the prefill action |
| `/admin/scan` health (service up or down) | **Core ACL** — `admin.scan`. App admin bypasses (`sf-staff-bypass`) |

**Rule of thumb:** Scan reads pixels and applies a map it was given. Forms owns the file field and the map. Media owns the file. Onboarding owns the slot date. Documents owns templates.

## Public door (planned)

`@/modules/scan/api.server`. Door id: `scan-api-server`. Forms loads it with `loadModuleDoor` only when the pack is enabled (same pattern as Onboarding → Documents). No client barrel. No static import from a `'use client'` file.

| Export | Behavior |
| --- | --- |
| `runScanDoor` | Pack off or authz failure → `{ ok: false, reason: 'disabled' }`. No reader call |
| `readImage` | Send the image to the local reader. Returns lines, boxes, page size, QR payloads, and whether a border was found |
| `applyReadMap` | Pure. Zones and labels in, `{ values, missed }` out. No network |

`readImage` reasons: `disabled`, `unavailable` (service down or bad token), `rejected` (mime or size). A missing border is `ok: true` with `foundBorder: false` and no lines. Callers leave inputs empty.

The library action `analyzeMediaAction` keeps running the port’s existing adapters. It does not pass a `scan` hook. Scan is reached only through this door.

Cross-pack callers use this door only. The reader URL, the HTTP client, and the Python process stay inside the pack.

## Reader process

`services/scan-reader/`. Python 3.11 on the host. Not a second product pack. Bind `127.0.0.1`. Require `Authorization: Bearer` matching `SCAN_READER_TOKEN`.

Site Settings → Modules only enables the pack. `modules:sync` only `npm install`s a JavaScript package. Neither one installs Python or pip packages. Do not add an npm `postinstall` that runs pip. Ship `requirements.txt` and an explicit setup script (`python -m venv .venv` then `pip install -r requirements.txt`) that an operator runs once. The host already has Python 3.11. The health page shows the reader down until that process is listening. A production image installs the same requirements in its own layer, the way Media treats ffmpeg as an optional system binary.

| Env | Role |
| --- | --- |
| `SCAN_READER_URL` | Pack → reader. Empty URL behaves as unavailable |
| `SCAN_READER_TOKEN` | Shared bearer. Production reject when the pack is on and the token is missing or a placeholder |

Libraries: OpenCV (headless) for the quad and the warp, RapidOCR for line boxes, ZXing or ZBar for QR. No cloud ID API. No model training.

`POST /read`. Body is the image (limit = Forms hard max, 10 MiB). Field `warp`:

| `warp` | Result |
| --- | --- |
| `card` | Largest four-corner outline, warped to ID-1 (85.60 × 53.98 mm) at a fixed pixel size |
| `page` | Same outline, warped with the quad’s own aspect |
| `none` | No warp. OCR the image as given (a stamp already cropped) |

Response: `{ foundBorder, width, height, lines: [{ text, box: { x, y, w, h } }], qr: string[] }`. Boxes are pixels of the image that was read (the warped card when warp succeeded). No border → `foundBorder: false`, empty `lines`.

## Field map (stored by Forms, executed here)

On the file field, next to `accept` / `maxSizeBytes` (`FormFileUploadConfig` in `src/modules/forms/types.ts`). The browser cannot submit this block. The server loads it from the saved definition, same rule as file accept.

```ts
read: {
  warp: 'card' | 'page' | 'none'
  fields: Array<{
    name: string
    zone?: { x: number; y: number; w: number; h: number }
    startsWith?: string
    take?: 'rest-of-line' | 'next-line'
    pattern?: string
    fromQr?: boolean
  }>
}
```

- `name` is another field on the same form.
- `zone` is a fraction of the read image (0–1). A line counts when its box center sits inside.
- `startsWith` matches the line after case-fold and accent-fold. The stored value keeps the original characters. `take` defaults to `rest-of-line`.
- `pattern` is a full-match regex. A miss drops that field.
- `fromQr` wins over the line when a code payload exists.
- A field with neither a zone, a label, nor `fromQr` is ignored.

`applyReadMap` returns only names that matched. It does not return the raw lines to the browser.

## Forms prefill (Forms slice, not the scaffold)

Today `ingestFormUploads` runs inside `submitFormAction`, after validation. Prefill needs the file stored earlier.

1. The file input posts to a Forms action `previewFormFileRead`.
2. That action loads the definition, refuses a client-supplied map, and no-ops the read when Scan is off (the file still uploads on submit, as today).
3. When Scan is on and the field has `read`: rate-limit, upload with the existing form-upload helper (private `forms` folder), call `readImage` then `applyReadMap`, return `{ mediaId, values }`.
4. The page writes `values` into the inputs. The person edits them.
5. Submit reuses that `mediaId` when the file is unchanged. A new file runs preview again. Submit still validates the edited values. It does not read the image a second time.

Raw OCR text is not written to media alt, tags, or the submission. The submission stores the edited field values and the `mediaId`.

The form-builder control for editing zones is a later slice. Until then the map is data on the definition. When that control ships, it follows [sf-admin-form-defaults](../../../.cursor/rules/sf-admin-form-defaults.mdc) (controlled value, or a remount key).

## Onboarding

No Onboarding table, column, or reader. After the Forms slice, the driver form definition may set `read` on the ID, licence, address-card, and stamp file fields, aimed at the inputs that form already has. `sf_onboarding_document_slots.validUntil` stays the date from that form. Staff still approve the slot.

Sample photos of each card are required before those maps are written. This plan does not invent zone numbers.

## Admin

| Surface | Path / key |
| --- | --- |
| Health | `/admin/scan` — reader reachable or not. No zone editor in the first admin slice |
| ACL | `admin.scan` (view / edit / manage). App admin bypasses |
| Post-save | Stays on `/admin/scan` |

## Schema

No `sf_scan_*` table in the slices below. The map lives on the Forms definition JSON. Secrets stay in env. A profile catalog table is a later decision, not part of this plan.

## Slice order

One slice per chat. Stop when that slice’s checks pass. **Do not start the scaffold in the plan-only chat.**

1. **Scaffold** — `src/modules/scan` manifest (`layer: advanced`, `defaultEnabled: false`, hard `requires`: Media), `runScanDoor` returns `disabled`, README Owns / Consumes, registry generate. No schema. `npm run check:atomic`.
2. **Reader** — `services/scan-reader` `POST /read` for `card`, `page`, and `none`. One fixture image with a known border. Missing border returns empty lines. Token required.
3. **Door** — `readImage` maps the JSON. Pack off → `disabled`. Connection failure → `unavailable`. Success returns lines. Library Analyze does not call it. Unit tests for those three paths.
4. **Map** — `applyReadMap`. Tests: zone hit, label hit, QR wins, pattern miss drops the value, no border → empty `values`.
5. **Forms prefill** — Forms `optionalRequires: product:scan`, `upload.read`, `previewFormFileRead`, submit reuses `mediaId`. Client fills inputs. Tests: mapped values returned; pack off leaves values empty and still accepts the file on submit; a client-sent map is ignored. Update the Forms README and this plan’s status on the live map in that slice.
6. **Health admin** — `/admin/scan`, ACL `admin.scan`.
7. **Driver form maps** — only after sample photos exist. Forms definition only. No Onboarding schema.

## Explicit non-goals

| Out | Why |
| --- | --- |
| `product:documents` | Templates and subject links. No pixels |
| Reader inside Onboarding | Slots stay `mediaId` + `validUntil` |
| Second media store or public OCR text on the media row | Media keeps bytes. Alt / tags stay for the library |
| Scan on every library Analyze | Port stays the library hook. This door is opt-in per file field |
| Handwriting | Printed lines and QR only. A failed pattern leaves the input empty |
| Cloud ID API, or a trained model | Local OpenCV + RapidOCR + a QR library |
| Zone editor, profile table, job queue | After a seeded form works. A slow read can move to JobRunner later |
| Hero card rules inside the pack | The company’s labels live on the form |

## When a decision accepts this plan

Update in that change, not before:

- [platform-module-layers](./platform-module-layers.md) — generic document reader is this pack; Hero keeps a single brand’s extra rules
- Live map — move the open row from “plan only” to the slice that landed
- Pack README — Owns / Consumes
- Forms README — when slice 5 adds `upload.read`

## Related

- Live map: [architecture-current](./architecture-current.md)
- Layers: [platform-module-layers](./platform-module-layers.md)
- Media port stub: [media-pipeline-plan](./media-pipeline-plan.md)
- Forms ownership: [sf-forms-module](../../../.cursor/rules/sf-forms-module.mdc)
- Onboarding slots: [onboarding-pack-plan](./onboarding-pack-plan.md)
- Documents (templates, not pixels): [documents-pack-plan](./documents-pack-plan.md)

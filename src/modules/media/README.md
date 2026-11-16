# product:media

Required Media library pack (design-module-boundary **M5**).

| Layer | Home |
| --- | --- |
| Library + Settings admin UI | `admin/` (App Router shims under `/admin/media`) |
| Document store | `schema.ts` — `sf_media_assets`, `sf_media_categories`, `sf_media_tags`, `sf_media_asset_tags`, `sf_media_owners` |
| Shared bind contract | `api.ts` (picker + pure helpers) · `api.server.ts` (`resolveMediaById`) |
| Ports (storage, pipeline, analysis, actions) | `src/core/media` — Core hosts |

## Owns

The media document store: asset meta (mime, alt, purpose, folder, private, urls/paths, sizes JSON), nested categories, and media-tags, in pack Drizzle tables (`sf_media_*`). Blobs go through the MediaStorage port (`src/core/media/storage`), local disk or S3. Object keys follow the category slug path on both (`logos/events/photo.webp`). Derivatives are the sharp pipeline (thumbnail / card / large) under `_derivatives` in that prefix. With local storage, files dropped into those folders are imported when an admin opens the library or the picker.

Library + Settings admin UI (`admin/`, App Router shims under `/admin/media`). Shared bind contract: bind **`mediaId`** only — **MediaPicker** / **MemberMediaPicker** (`sf_media_owners`); no forked library UI. Pipeline rules in `sf_media_settings` (Media → Settings).

**UX parity (phase 2a, done):** `/admin/media` is the daily path. The item panel edits alt, purpose, tags, private, and category. The list pages past 60. Tags are created and renamed in the library sidebar. Admins upload and browse images plus the document types Forms already allow (PDF, Word, plain text), including private and form files. Replace file reruns the sharp pipeline and regenerates derivatives. ImageFrame stays the display crop. There is no focal-point editor.

**Document store (phase 2b, done):** meta, categories, and media-tags live in `sf_media_*`. Migrated ids are the old numeric id as text, so existing `mediaId` binds and `sf_media_owners` stay valid. New rows use uuid text ids. `payload_legacy_id` is the one-shot copy key. Page tags are `sf_pages_tags`. Brochure pages are edited at `/admin/pages`.

## Consumes

Ports (storage, pipeline, analysis, actions) in `src/core/media` — Core hosts.

Payload is not the media document store. Do not add media features as a second library. Media does not go back into a CMS package. `npm run db:migrate` drops a leftover `payload` schema after the one-shot copy.

## Public door

`@/modules/media/api` (picker + pure helpers) · `@/modules/media/api.server` (`resolveMediaById`). Client code must not import `api.server`.

## Image engine

Decode / resize / WebP re-encode uses **sharp** (bundled libvips). No PHP GD, ImageMagick, or Jimp. `npm install` pulls the matching `@img/sharp-*` binary for the host OS.

Pipeline rules (max W×H, JPEG/WebP quality, thumbnail / card / large edges, keep-PNG-for-logos, and per-group decode/resize choice) live in `sf_media_settings` — edit under **Media → Settings**. Photos (PNG/JPEG/GIF) become WebP by default; logo purpose can keep PNG/JPEG. Upload UI shows **Decode to WebP** and **Resize** when the viewer’s group is set to Can choose (app admins always can).

## Consumers

```ts
import { MediaPicker } from '@/modules/media/api'
import { resolveMediaById } from '@/modules/media/api.server'
```

Client code must not import `api.server`. Forms, Layout Styles/Logo, Events, Profiles, and Marketplace bind **`mediaId`** only — no forked library UI.

**Member uploads** (`MemberMediaPicker` + `sf_media_owners`): signed-in members upload through the same Media pipeline without admin rights; consumers call `memberOwnsMedia` before storing a member-supplied id. Encode toggles follow the same Media settings group maps.

## Site Settings → Modules

Catalog row is **required / locked on** (Logo and other Core binds need the store). Toggle architecture still lists it; off is not supported.

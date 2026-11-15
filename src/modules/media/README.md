# product:media

Required Media library pack (design-module-boundary **M5**).

| Layer | Home |
| --- | --- |
| Library + Settings admin UI | `admin/` (App Router shims under `/admin/media`) |
| Shared bind contract | `api.ts` (picker + pure helpers) · `api.server.ts` (`resolveMediaById`) |
| Ports (storage, pipeline, analysis, actions) | `src/core/media` — Core hosts |

## Owns

Library + Settings admin UI (`admin/`, App Router shims under `/admin/media`). Shared bind contract: bind **`mediaId`** only — **MediaPicker** / **MemberMediaPicker** (`sf_media_owners`); no forked library UI. Pipeline rules in `sf_media_settings` (Media → Settings).

**UX parity (phase 2a, done):** `/admin/media` is the daily path. The item panel edits alt, purpose, tags, private, and category. The list pages past 60. Tags are created and renamed in the library sidebar. Admins upload and browse images plus the document types Forms already allow (PDF, Word, plain text), including private and form files. Replace file runs the existing sharp pipeline and Payload `imageSizes`. ImageFrame stays the display crop. There is no Payload focal-point editor.

**Document store (phase 2b, not moved):** this pack will take meta, categories, and media-tags that still sit in Payload `media` / `categories` / `tags`. `getPayload()` stays in `src/core/media` until that move. Blobs stay on MediaStorage. Do not start 2b in a UX-only change. Order: [payload-dependency-map](../../../docs/project-context/docs/payload-dependency-map.md).

## Consumes

Ports (storage, pipeline, analysis, actions) in `src/core/media` — Core hosts.

Payload (`getPayload()` in `src/core/media/*`, and `@payloadcms/storage-s3` while S3 still goes through the Payload plugin) is the current document backend only. It is not the long-term store. Do not add media features as new Payload collections. Media does not go back into Payload after the peel.

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

Client code must not import `api.server` (keeps Payload out of the client graph). Forms, Layout Styles/Logo, Events, Profiles, and Marketplace bind **`mediaId`** only — no forked library UI.

**Member uploads** (`MemberMediaPicker` + `sf_media_owners`): signed-in members upload through the same Media pipeline without admin rights; consumers call `memberOwnsMedia` before storing a member-supplied id. Encode toggles follow the same Media settings group maps.

## Site Settings → Modules

Catalog row is **required / locked on** (Logo and other Core binds need the store). Toggle architecture still lists it; off is not supported.

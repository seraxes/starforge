# product:media

Layer: base (manifest boot tag)

Class: base — depends only on Core ([2026-11-26-base-vs-advanced](../../../docs/project-context/docs/decisions/2026-11-26-base-vs-advanced.md))

Status: shipped

Required Media library pack (design-module-boundary **M5**). Catalog row is **required / locked on** (Logo and other Core binds need the store). Toggle architecture still lists it; off is not supported.

## Owns

The media document store: asset meta (mime, alt, purpose, folder, private, urls/paths, sizes JSON), nested categories, and media-tags, in pack Drizzle tables — `sf_media_assets`, `sf_media_categories`, `sf_media_tags`, `sf_media_asset_tags`, `sf_media_owners`. Blobs go through the MediaStorage port (`src/core/media/storage`), local disk or S3. Object keys follow the category slug path on both (`logos/events/photo.webp`). Derivatives are the sharp pipeline (thumbnail / card / large) under `_derivatives` in that prefix. With local storage, files dropped into those folders are imported when an admin opens the library or the picker.

Library + Settings admin UI (`admin/`, App Router shims under `/admin/media`). Shared bind contract: bind **`mediaId`** only — **MediaPicker** / **MemberMediaPicker** (`sf_media_owners`); no forked library UI. Pipeline rules in `sf_media_settings` (Media → Settings).

**UX parity (phase 2a, done):** `/admin/media` is the daily path. The item panel edits alt, purpose, tags, private, and category. The list pages past 60. Tags are created and renamed in the library sidebar. Admins upload and browse images plus the document types Forms already allow (PDF, Word, plain text), including private and form files. Replace file reruns the sharp pipeline and regenerates derivatives. ImageFrame stays the display crop. There is no focal-point editor.

**Document store (phase 2b, done):** meta, categories, and media-tags live in `sf_media_*`. Migrated ids are the old numeric id as text, so existing `mediaId` binds and `sf_media_owners` stay valid. New rows use uuid text ids. `payload_legacy_id` is the one-shot copy key. Page tags are `sf_pages_tags`. Brochure pages are edited at `/admin/pages`.

**Image engine:** Decode / resize / WebP re-encode uses **sharp** (bundled libvips). Pipeline rules (max W×H, JPEG/WebP quality, thumbnail / card / large edges, keep-PNG-for-logos, and per-group decode/resize choice) live in Media → Settings. Photos become WebP by default; logo purpose can keep PNG/JPEG. Upload UI shows **Decode to WebP** and **Resize** when the viewer’s group is set to Can choose (app admins always can).

**Member uploads** (`MemberMediaPicker` + `sf_media_owners`): signed-in members upload through the same Media pipeline without admin rights; consumers call `memberOwnsMedia` before storing a member-supplied id.

**Drop to upload:** `MediaPicker` and `MemberMediaPicker` (and `MediaFileField`) accept drag-and-drop on the field chrome and the library dialog — shared helpers in `admin/media-drop.ts`. Dropping an image uploads through the same pipeline as the Upload control.

## Consumes

Ports (storage, pipeline, analysis, actions) in `src/core/media` — Core hosts. Payload is not the media document store. Do not add media features as a second library. Media does not go back into a CMS package. `npm run db:migrate` drops a leftover `payload` schema after the one-shot copy. No module `requires`.

## Public door

- `@/modules/media/api` — `MediaPicker`, `MemberMediaPicker`, `ImageFrameEditor`, `FramedImage`, `MediaLightbox`, `MediaCategoryTree`, image-frame helpers (`DEFAULT_IMAGE_FRAME`, `normalizeImageFrame`, `parseImageFrameJson`, `computeImageFrameLayout`, `imageFrameLayoutStyle`, `imageFrameImgStyle`, `mediaFrameSrc`, `mediaLightboxSrc`), category/tag helpers (`flattenCategoryOptions`, `findCategoryInTree`, `normalizeMediaPurposeFilter`, `parseMediaTagFilter`, `serializeMediaTagFilter`), related types
- `@/modules/media/api.server` — `findMediaById`, `listMedia`, `listMediaTagOptions`, `preferredMediaUrl`, `resolveMediaBind`, `resolveMediaById`, `toResolvedMedia`, `MEMBER_UPLOAD_MAX_BYTES`, `listMemberMedia`, `memberOwnsMedia`, frame helpers, `ImageFrame` type

Client code must not import `api.server`. Forms, Layout Styles/Logo, Events, Profiles, and Marketplace bind **`mediaId`** only.

## Admin surfaces

- `/admin/media`, `/admin/media/settings` (Media → Settings)
- ACL area: `media`
- Dashboard: `media.counts`

## Boot and jobs

None as module boot. Local storage import on library/picker open; sharp pipeline on upload/replace.

## Known gaps

- Pack off is not supported architecturally (required / locked on)
- No focal-point editor (ImageFrame for crop)
- Media bytes follow the owning Social audience on `/api/media/[id]` and `/api/media/file/[...key]` via Social’s `decideSocialMediaServeAccess` (app routes use `loadModuleDoor('social-api-server')`; this pack does not import Social)

## Tests

`src/modules/media/dashboard/media-kind.test.ts` (plus Core media tests under `src/core/media/*` in `test:unit`)

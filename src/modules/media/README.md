# product:media

Required Media library pack (design-module-boundary **M5**).

| Layer | Home |
| --- | --- |
| Library + Settings admin UI | `admin/` (App Router shims under `/admin/media`) |
| Shared bind contract | `api.ts` (picker + pure helpers) · `api.server.ts` (`resolveMediaById`) |
| Ports (storage, pipeline, analysis, actions) | `src/core/media` — Core hosts |

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

# product:media

Required Media library pack (design-module-boundary **M5**).

| Layer | Home |
| --- | --- |
| Library + Settings admin UI | `admin/` (App Router shims under `/app/admin/media`) |
| Shared bind contract | `api.ts` — `MediaPicker`, `resolveMediaById`, tag/category filters |
| Ports (storage, pipeline, analysis, actions) | `src/core/media` — Core hosts |

## Consumers

```ts
import { MediaPicker, resolveMediaById } from '@/modules/media/api'
```

Forms, Layout Styles/Logo, and future Events/Ads/Marketplace bind **`mediaId`** only — no forked library UI.

## Site Settings → Modules

Catalog row is **required / locked on** (Logo and other Core binds need the store). Toggle architecture still lists it; off is not supported.

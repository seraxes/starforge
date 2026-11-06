# Media pipeline plan (SF-28 → SF-66 → SF-117)

**Layer:** **Modules** (library UX + sharp/ffmpeg pipeline + tags/categories). **Core ports:** `MediaStorage` (local → Spaces/S3), later `MediaAnalysisPort` (OCR/vision hooks). Quality-check AI **apps** = **Hero** (or external) consumers of that port — they do not fork Media ([platform-module-layers](./platform-module-layers.md)).

**Goal:** One Payload Media library + Starforge pipeline/UI; bind Styles / Logo / Form option media to library IDs. S3/Spaces later as a storage port.

**SF-117 (this pass):** Lock the **image decoder / resize / recompress** stack and a **configurable rules** shape — plan + tiny typed stub; no full Site Settings UI yet.

## Recommendation (chat summary)

| Choice | Decision |
| --- | --- |
| **Images** | **`sharp` (libvips)** — already in `package.json` + `payload.config.ts` |
| **Video** | **`ffmpeg`** (optional later) — H.264 MP4 + WebM rules; max duration / file size |
| Avoid (images) | **ImageMagick / Imagick / `gm`**, Jimp, Squoosh, Magick.wasm |
| Avoid (video) | Browser-only re-encode as the server path; HandBrake GUI; custom C++ codecs |
| Wire points (images) | Payload `upload` sizes + Core `preprocessUploadBuffer` + Media `beforeChange` |
| Rules | Typed image + (later) video rule objects — see below |
| Camera (images) | Core upload `accept="image/*" capture="environment"` (shipped) |

**Why sharp for images:** Payload 3 and Next both expect sharp; one dependency covers Core preprocess and Payload derivatives; prebuilt libvips binaries (no apt `imagemagick` on DO); fast memory profile for multi-size WebP. Imagick is the Joomla/PHP habit — do not port it.

**Why ffmpeg for video (easiest path, later):** Industry default for transcode/probe; one CLI covers H.264 (universal playback) + VP9/AV1 WebM; `ffprobe` for duration/size gates; install via apt/`ffmpeg-static` when video uploads ship — **do not block image SF-117 on video**.

## Principles

- **One store** — Payload `media` only; features tag/filter/ACL the same files ([modular-core](../principles/modular-core.md)).
- **Port vs Module** — Object storage is a **Core** port (local disk now → Spaces/S3 later). Library UX is a **Module** surface around Payload, not a second media DB ([replaceable-modularity-plan](./replaceable-modularity-plan.md)).
- **IDs primary** — Bindings store `mediaId` (and optional resolved URL cache); raw URL remains advanced/fallback only.
- **One image engine** — All image resize/recompress goes through **sharp** (Payload-injected + Core preprocess). No second image decoder.
- **One video engine (later)** — All video probe/transcode goes through **ffmpeg**; same Payload `media` store, separate mime path + rules. Images stay sharp-only.

## Recommended packages

### Images (now)

| Package | Role | Status |
| --- | --- | --- |
| `sharp` | Decode, EXIF rotate, resize, JPEG/WebP/PNG encode | **Ship** (already `0.34.x`) |
| Payload `upload` + `sharp` in `buildConfig` | Collection `resizeOptions` / `imageSizes` / `formatOptions` | **Ship** |
| *(optional later)* HEIC → JPEG/WebP helper | iPhone camera originals when sharp build lacks HEIF | Defer until mobile uploads fail in the wild |
| ImageMagick / `imagemagick` / `gm` | — | **Do not add** |
| Jimp / `@squoosh/lib` | — | **Do not add** |

No extra image “decoder module” packages beyond sharp: Payload’s upload pipeline **is** the derivative module; Starforge Core owns **original** preprocess rules.

### Video (optional later — easiest path)

| Package / binary | Role | Status |
| --- | --- | --- |
| **`ffmpeg` + `ffprobe`** | Transcode, thumbnail frame, duration/bitrate probe | **Later** when video mime allowed |
| `ffmpeg-static` *or* apt `ffmpeg` on droplet | Pin binary for local/CI vs system package in prod | Pick at wire time (static = easiest local) |
| Thin Core wrapper (e.g. `execa` / `fluent-ffmpeg`) | Spawn ffmpeg with fixed argv from rules | Later — keep wrapper thin; rules own flags |
| Browser MediaRecorder-only | — | **Not** the server pipeline (optional client hint only) |

**Do not** use sharp for video. **Do not** add a second transcoder (HandBrake CLI, custom GStreamer) unless ffmpeg cannot meet a measured need.

## Rule config shape

Canonical object (code stub in `src/core/media/pipeline.ts`; Site Settings toggle later):

```ts
export type MediaPipelineRules = {
  /** Cap longest edges on originals (no enlargement). */
  maxWidth: number
  maxHeight: number
  /** JPEG re-encode when keeping JPEG (e.g. logo JPEG). */
  jpegQuality: number
  /** WebP quality for photo originals + Payload size derivatives. */
  webpQuality: number
  /** Photo / other originals: always WebP (default). */
  photoOriginalFormat: 'webp'
  /** PNG mime always kept; purpose=logo also skips forced WebP. */
  keepPngForLogos: true
  sizes: {
    thumbnail: number // square crop edge
    card: number      // width
    large: number     // width
  }
}
```

**Default values (current):** `2560×2560`, JPEG `82`, WebP `80`, sizes `320` / `768` / `1920`.

**Rule outcomes:**

| Input | Purpose | Original result | Derivatives |
| --- | --- | --- | --- |
| PNG | any / logo | **Keep PNG** (resize only) | WebP sizes still generated by Payload |
| JPEG/WebP/GIF/… | `photo` / `other` | **WebP** @ `webpQuality` | WebP thumbnail / card / large |
| JPEG | `logo` | Keep JPEG @ `jpegQuality` (no forced WebP) | WebP sizes |

Public resolve prefers WebP size URLs unless `purpose === 'logo'` or mime/filename is PNG.

### Video rules (optional later — not shipped)

```ts
export type VideoPipelineRules = {
  /** Reject before transcode if over. */
  maxDurationSec: number // e.g. 120
  maxUploadBytes: number // e.g. 100_000_000
  /** Primary delivery: H.264 + AAC in MP4 (widest playback). */
  h264: {
    enabled: true
    videoCodec: 'libx264'
    audioCodec: 'aac'
    maxHeight: number // e.g. 1080 — scale down only
    crf: number // e.g. 23
    preset: 'veryfast' | 'fast' | 'medium'
  }
  /** Modern optional sibling: WebM (VP9) for supporting clients. */
  webm: {
    enabled: boolean // default true when video ships
    videoCodec: 'libvpx-vp9'
    audioCodec: 'libopus'
    maxHeight: number
    crf: number // e.g. 32
  }
  /** Poster frame via ffmpeg `-ss` + single image → sharp thumbs optional. */
  poster: { enabled: true; atSec: number }
}
```

**Easiest default when video lands:** accept short clips → `ffprobe` gate (duration + size) → emit **one H.264 MP4** (+ optional WebM) + poster JPEG/WebP; store all as Payload media (or related size fields). Queue/transcode async later if uploads block the request (Redis queue when prod Redis exists). Until then: **images only** (`mimeTypes: ['image/*']`).

## Payload + Core upload hooks

```
[browser] file / camera
    → Core uploadMediaAction (admin) OR Payload CMS Media upload
        → Core preprocessUploadBuffer (sharp)     // originals + format rules
        → payload.create({ collection: 'media', file })
            → Payload sharp: resizeOptions + imageSizes WebP
    → resolveMediaById / preferredMediaUrl
```

| Hook | Owner | Responsibility |
| --- | --- | --- |
| `preprocessUploadBuffer` | `src/core/media/actions.ts` | EXIF `.rotate()`, max edge, photo→WebP, PNG/logo exception |
| `upload.resizeOptions` / `imageSizes` | `src/collections/Media.ts` | Second-pass cap + named WebP derivatives |
| `hooks.beforeChange` (create) | Media collection (SF-117 stub / follow-up) | Same preprocess when upload bypasses Core UI (Payload admin / Lexical) |
| `sharp` in `buildConfig` | `src/payload.config.ts` | Required Payload image adapter |

**Follow-up (small):** Shared `applyMediaPipelineRules(buffer, { mime, purpose, rules })` used by Core action **and** Media `beforeChange` so CMS-only uploads obey the same rules. Do not duplicate Imagick shell-outs.

## PNG logos exception

- Editors set **Purpose = Logo** (and/or upload PNG).
- Pipeline **must not** flatten transparency or force WebP for logo originals.
- Bindings (Logo particle, etc.) use original URL via `preferredMediaUrl` when logo/PNG.
- WebP size derivatives may still exist for admin thumbs; public logo bind uses original.

## Mobile camera upload

Already on Core Media library + Media picker:

```html
<input type="file" name="file" accept="image/*" capture="environment" />
```

- `accept="image/*"` — gallery + common camera formats.
- `capture="environment"` — hint rear camera on phones (browsers may still offer picker).
- Same sharp pipeline after upload (orientation via `.rotate()`).
- HEIC: monitor; add a dedicated convert step only if real devices fail (prefer sharp/libheif over Imagick).

## SF-28 foundation (shipped)

| Slice | Deliverable |
| --- | --- |
| Collection | `folder` (category) + `purpose` (`logo` \| `photo` \| `other`); alt required |
| Pipeline | Max W×H resize; Core upload preprocesses (JPEG quality / photo→WebP; **PNG logos kept**); Payload WebP size derivatives; no top-level force-convert |
| Storage port | `MediaStorage` + local adapter; S3 stub behind env (unimplemented until DO) |
| Core admin | `/app/admin/media` — browse/filter by folder, mobile-friendly upload (`capture`), link to Payload CMS Media |
| Resolve helpers | `resolveMediaById` / preferred public URL (prefer WebP size unless logo/PNG) |
| Public bind | Thin `GET /api/media/[id]` → redirect to file URL (Form options / interim clients) |

## SF-66 wire (shipped)

| Surface | Change |
| --- | --- |
| Logo particle | Media picker; **prefer `mediaId` over `mediaUrl`** |
| Section Styles | `backgroundMediaId` + picker; URL field demoted to advanced |
| Form option media | Picker sets `mediaId` (+ alt); URL optional fallback |

## SF-117 / next slices

| Slice | Deliverable |
| --- | --- |
| Docs + prefs | This plan; preferences: images=sharp, video=ffmpeg (later) |
| Typed rules | `MediaPipelineRules` + `DEFAULT_MEDIA_PIPELINE_RULES` in `pipeline.ts` |
| Shared apply | Extract preprocess; call from Core + Media `beforeChange` |
| Site Settings | Optional Performance/Media topic later — edit max/quality without code (modular toggle) |
| Video (later) | `VideoPipelineRules` + ffmpeg/ffprobe; keep images on sharp only |

## Taxonomy: tags + categories (same library)

**Still one Payload `media` store** — no second media DB. Taxonomy is metadata on the same files so Events galleries, Social, Stream, Shop, Ads, and Form option media can filter without forking storage ([modular-core](../principles/modular-core.md)).

| Facet | Shape | Notes |
| --- | --- | --- |
| **Folder** (shipped) | String / select on Media | Coarse browse buckets in Media admin |
| **Purpose** (shipped) | `logo` \| `photo` \| `other` | Pipeline + public URL preference |
| **Categories** (next) | Shared taxonomy refs (Payload collection or `sf_categories`) | Hierarchical optional; multi-assign per asset |
| **Tags** (next) | Shared `sf_tags` (or Payload tags) reused by pages/posts/media | Flat multi-select; filter + search later |
| **ACL** (later) | Group tags OR-match (same as Nav/layout/pages) | Empty = anyone who can reach the surface; never a parallel Access Level entity |

**Principles:**

- Features **tag / category / ACL** the same IDs — they do not own copies.
- Prefer one shared tag/category collection across content + Media (see inventory Taxonomy row) — Media is a consumer, not a private taxonomy silo.
- Core Media admin: filter by folder + purpose **now**; add category/tag facets when taxonomy ships; Styles / Logo / Form pickers stay `mediaId`-primary.

## AI / OCR / vision hooks (Core port — later)

Analyzers plug in **without forking Media**. Same pattern as Mailer: thin **Core** port + adapters; secrets in env; Media **Module** stays the library. **Hero** quality-check apps (or external tools) register/call adapters — they are not a second Media store.

### Port shape (Mailer-like)

```ts
/** Result written back as Media metadata / derived fields — never a second blob store. */
export type MediaAnalysisResult = {
  ok: boolean
  /** Machine-readable kind for adapters (ocr, quality, vision, moderation, …). */
  kind: string
  /** Optional human summary for admin UI. */
  summary?: string
  /** Structured payload (OCR text, scores, labels, bounding boxes, …). */
  data?: Record<string, unknown>
  /** Suggested Media field patches (alt, tags[], categoryIds[], purpose, …) — editor confirms. */
  suggestions?: {
    alt?: string
    tagIds?: string[]
    categoryIds?: string[]
    purpose?: 'logo' | 'photo' | 'other'
  }
}

export type MediaAnalyzerInput = {
  mediaId: string
  mime: string
  /** Local path, buffer, or signed URL — adapter chooses; Core resolves from MediaStorage. */
  source: { buffer?: Buffer; url?: string; path?: string }
  purpose?: 'logo' | 'photo' | 'other'
  /** Which analyzers to run (allowlist); empty = Site Settings default set. */
  hooks?: string[]
}

export type MediaAnalyzer = {
  id: string
  /** e.g. ocr | quality | vision | moderation */
  kind: string
  analyze(input: MediaAnalyzerInput): Promise<MediaAnalysisResult>
}

export type MediaAnalysisPort = {
  /** Registered adapters (console stub, HTTP webhook, vendor SDK, …). */
  list(): MediaAnalyzer[]
  run(input: MediaAnalyzerInput): Promise<MediaAnalysisResult[]>
}
```

| Piece | Role |
| --- | --- |
| **`MediaAnalysisPort`** | Factory from Site Settings enable + env secrets; runs selected hooks after upload or on demand |
| **Adapters** | `console` (dev), `http` (POST signed URL + JSON back), vendor SDKs later — **no** hard-coded vendor in Media collection |
| **Trigger** | Optional post-upload (async when Redis/queues exist) or admin “Analyze” on library row |
| **Write-back** | Results + suggestions on Media metadata; **editor confirms** alt/tags — do not silently overwrite |
| **Secrets** | API keys in env / Environment editor only — never DB |

**Out of scope now:** shipping any vendor; quality/OCR apps are future consumers of this port. Keep **sharp** / **ffmpeg** as the encode path; analyzers read outputs, they do not replace the pipeline.

## SF-148 (shipped — thin Must)

| Slice | Deliverable |
| --- | --- |
| Shared sharp apply | `MediaPipelineRules` + `applyMediaPipelineRules`; Core upload + Media `beforeChange` |
| S3/Spaces | Already on main (#77); verified throw-on-incomplete; env docs refreshed |
| Tags facet | Media `tags` → shared Payload `tags`; Core library filter + optional upload tag |
| Analysis stub | `MediaAnalysisPort` + noop adapter (no vendor, no auto-run, no write-back UI) |
| Module boundary | `product:media` manifest (`required: true`); UI still in `src/core/media` until M5 |

## Explicitly later

- Rich ACL on Media (group tags) beyond folder + purpose
- Categories hierarchy (beyond folder select)
- Real OCR/AI adapters + admin Analyze + suggestion confirm UI
- Full M5 move of library UI into `src/modules/media`
- Full gallery / stream modules (filter the same library)
- Site Settings UI for pipeline numbers + analyzer toggles
- HEIC convert only if needed
- **Video uploads:** open `video/*` on Media; ffmpeg/ffprobe + `VideoPipelineRules` (H.264 MP4, optional WebM, max duration/size, poster); async queue when needed

## Success

Editors pick library assets from Core admin without pasting URLs as the primary path; Payload remains the store; **sharp** applies configurable WebP/PNG image rules for Core and CMS uploads; **ffmpeg** is the reserved video path (optional, later) with H.264/WebM + duration/size gates — no ImageMagick; taxonomy tags/categories ACL the **same** files; external AI/OCR/vision analyzers plug via **`MediaAnalysisPort`** without a second media store; ops can swap storage via env when hosting is ready.

## Related

- [core-modules-inventory](./core-modules-inventory.md) (Media + Taxonomy rows)
- [platform-module-layers](./platform-module-layers.md)
- [events-manager-plan](./events-manager-plan.md) (galleries filter Media)
- [maps-location-plan](./maps-location-plan.md)

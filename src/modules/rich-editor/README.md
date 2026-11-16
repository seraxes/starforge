# product:rich-editor

Shared **TipTap** content editor for Starforge module fields. Canonical storage is **sanitized HTML**.

## Owns

TipTap engine in this pack (`RichEditor`, sanitize, nodes). Presets `full` | `compact` | `email`. Settings: `/admin/rich-editor/settings`. Toggle: **Site Settings → Modules → Rich editor** (`product:rich-editor` / `richEditor`).

## Consumes

`MediaPicker` from `@/modules/media/api` — other packs pass it in; the editor file does not import the media module. **Email Manager** binds `preset="email"` with `MediaPicker`.

## Public door

`@/modules/rich-editor/api` · `@/modules/rich-editor/api.server` (server pages and saves: `isRichEditorEnabled`, `sanitizeRichHtml`, `sanitizeEmailHtml`).

## Bind from another module

```tsx
import { MediaPicker } from '@/modules/media/api'
import { RichEditor, RichContent } from '@/modules/rich-editor/api'
import {
  isRichEditorEnabled,
  sanitizeEmailHtml,
  sanitizeRichHtml,
} from '@/modules/rich-editor/api.server' // server pages and saves

const settings = await getSiteSettings()
const richOn = isRichEditorEnabled(settings)

<RichEditor
  name="description"
  defaultValue={row.description}
  label="Description"
  enabled={richOn}
  preset="full" // or "compact" | "email"
  MediaPicker={MediaPicker}
/>

const description = sanitizeRichHtml(String(formData.get('description') ?? ''))
const bodyHtml = sanitizeEmailHtml(raw, { baseUrl: appOrigin() })

<RichContent html={event.description} />
```

### Presets

| Preset | Use |
| --- | --- |
| `full` | Events / Pages — callout, video, gallery, color, images |
| `compact` | Shorter toolbar (H2–H3, lists, links; no media blocks by default) |
| `email` | Transactional HTML for **Email Manager** — no video/gallery/callout/color; email allowlist via `sanitizeEmailHtml` |

**Email Manager** declares `requires: ['product:rich-editor', 'product:media']` and binds `preset="email"` with `MediaPicker`.

Toggle: **Site Settings → Modules → Rich editor** (`product:rich-editor` / `richEditor`). When `enabled={false}`, TipTap falls back to a plain textarea (Email templates show a require notice instead).

## Engine

The TipTap engine lives in this pack (`RichEditor`, sanitize, nodes). Other packs bind `@/modules/rich-editor/api` and pass `MediaPicker` from `@/modules/media/api`. The editor file does not import the media module. Settings: `/admin/rich-editor/settings`.

`product:pages` sanitizes body HTML with `sanitizeRichHtml` on save. Public render is `RichContent`. Old Lexical JSON still renders through `RichText` when `product:lexical-editor` is on (`@payloadcms/richtext-lexical`).

Popups: Link, Callout (portal). Video: inline Media / YouTube–Vimeo panel under the toolbar.

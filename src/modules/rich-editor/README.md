# product:rich-editor

Shared **TipTap** content editor for Starforge module fields. Canonical storage is **sanitized HTML**.

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

Page body save sanitizes in `sfHtmlBodyField` (`beforeValidate` → `sanitizeRichHtml`). That hook imports `../sanitize` directly so the Pages collection config does not load Site Settings.

## Payload Pages

Pages `body` uses TipTap HTML via `sfHtmlBodyField()` + `SfHtmlField` (Payload admin). The locale column is text (`20261111_pages_body_html_text`); unread Lexical documents stay as JSON text. Public render: `RichContent`, or `RichText` when that text is still a Lexical document.

Popups: Link, Callout (portal). Video: inline Media / YouTube–Vimeo panel under the toolbar.

`@payloadcms/richtext-lexical` remains only so public `RichText` can still render old Lexical JSON until pages are re-saved as HTML.

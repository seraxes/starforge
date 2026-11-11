# product:rich-editor

Shared **TipTap** content editor for Starforge module fields. Canonical storage is **sanitized HTML**.

## Bind from another module

```tsx
import {
  RichEditor,
  RichContent,
  sanitizeRichHtml,
  sanitizeEmailHtml,
} from '@/modules/rich-editor/api'
import { isRichEditorEnabled } from '@/modules/rich-editor/api.server' // server pages only

// Server page: pass the Site Settings → Modules gate
const settings = await getSiteSettings()
const richOn = isRichEditorEnabled(settings)

<RichEditor
  name="description"
  defaultValue={row.description}
  label="Description"
  enabled={richOn}
  preset="full" // or "compact" | "email"
/>

// Persist (web):
const description = sanitizeRichHtml(String(formData.get('description') ?? ''))

// Persist (email templates — Email Manager):
const bodyHtml = sanitizeEmailHtml(raw, { baseUrl: appOrigin() })

// Public / preview (web only — do not use RichContent for Mailer HTML):
<RichContent html={event.description} />
```

### Presets

| Preset | Use |
| --- | --- |
| `full` | Events / Pages — callout, video, gallery, color, images |
| `compact` | Shorter toolbar (H2–H3, lists, links; no media blocks by default) |
| `email` | Transactional HTML for **Email Manager** — no video/gallery/callout/color; email allowlist via `sanitizeEmailHtml` |

**Email Manager** declares `requires: ['product:rich-editor']` and binds `preset="email"`.

Toggle: **Site Settings → Modules → Rich editor** (`product:rich-editor` / `richEditor`). When `enabled={false}`, TipTap falls back to a plain textarea (Email templates show a require notice instead).

## Engine

Implementation: `src/core/rich-editor/`. Pack owns catalog + `@/modules/rich-editor/api` + Settings page at `/admin/rich-editor/settings`.

## Payload Pages

Pages `body` uses TipTap HTML via `sfHtmlBodyField()` + `SfHtmlField` (Payload admin). Public render: `RichContent` (legacy Lexical JSON still accepted by `RichText` during migration).

Popups: Link, Callout (portal). Video: inline Media / YouTube–Vimeo panel under the toolbar.

`@payloadcms/richtext-lexical` remains only so public `RichText` can still render old Lexical JSON until pages are re-saved as HTML.

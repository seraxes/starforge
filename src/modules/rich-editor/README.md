# product:rich-editor

Layer: base

Status: shipped

## Owns

Shared **TipTap** content editor for module fields. Canonical storage is **sanitized HTML**. TipTap engine in this pack (`RichEditor`, sanitize, nodes). Presets `full` | `compact` | `email`. Settings at `/admin/rich-editor/settings`. Toggle: Site Settings → Modules → Rich editor (`product:rich-editor` / `richEditor`). When `enabled={false}`, TipTap falls back to a plain textarea (Email templates show a require notice instead). Popups: Link, Callout (portal). Video: inline Media / YouTube–Vimeo panel under the toolbar. No `sf_*` tables.

| Preset | Use |
| --- | --- |
| `full` | Events / Pages — callout, video, gallery, color, images |
| `compact` | Shorter toolbar (H2–H3, lists, links; no media blocks by default) |
| `email` | Transactional HTML for Email Manager — no video/gallery/callout/color; email allowlist via `sanitizeEmailHtml` |

`product:pages` sanitizes body HTML with `sanitizeRichHtml` on save. Public render is `RichContent`. Old Lexical JSON still renders through `RichText` when `product:lexical-editor` is on.

## Consumes

- **`product:media`** (hard `requires`) — callers pass `MediaPicker` from `@/modules/media/api`; the editor file does not import the media module. Email Manager binds `preset="email"` with `MediaPicker`.

## Public door

- `@/modules/rich-editor/api` — `RichEditor`, `RichContent`, `sanitizeRichHtml`, `sanitizeEmailHtml`
- `@/modules/rich-editor/api.server` — `RICH_EDITOR_MODULE_ID`, `isRichEditorEnabled`, `sanitizeRichHtml`, `sanitizeEmailHtml`

```tsx
import { MediaPicker } from '@/modules/media/api'
import { RichEditor, RichContent } from '@/modules/rich-editor/api'
import {
  isRichEditorEnabled,
  sanitizeEmailHtml,
  sanitizeRichHtml,
} from '@/modules/rich-editor/api.server'
```

## Admin surfaces

- `/admin/rich-editor/settings`
- Toggle: Site Settings → Modules

## Boot and jobs

None.

## Known gaps

- Legacy Lexical JSON render remains via optional `product:lexical-editor`

## Tests

`src/modules/rich-editor/sanitize.test.ts`, `src/modules/rich-editor/video.test.ts`

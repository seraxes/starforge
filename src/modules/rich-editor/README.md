# product:rich-editor

Shared **TipTap** content editor for Starforge module fields. Canonical storage is **sanitized HTML**.

## Bind from another module

```tsx
import { RichEditor, RichContent, sanitizeRichHtml } from '@/modules/rich-editor/api'
import { isRichEditorEnabled } from '@/modules/rich-editor/api.server' // server pages only

// Server page: pass the Site Settings → Modules gate
const settings = await getSiteSettings()
const richOn = isRichEditorEnabled(settings)

<RichEditor
  name="description"
  defaultValue={row.description}
  label="Description"
  enabled={richOn}
/>

// Persist:
const description = sanitizeRichHtml(String(formData.get('description') ?? ''))

// Public / preview:
<RichContent html={event.description} />
```

Toggle: **Site Settings → Modules → Rich editor** (`product:rich-editor` / `richEditor`). When `enabled={false}`, TipTap falls back to a plain textarea.

## Engine

Implementation: `src/core/rich-editor/`. Pack owns catalog + `@/modules/rich-editor/api` + Settings page at `/admin/rich-editor/settings`.

## Payload Pages

Pages `body` uses TipTap HTML via `sfHtmlBodyField()` + `SfHtmlField` (Payload admin). Public render: `RichContent` (legacy Lexical JSON still accepted by `RichText` during migration).

Popups: Link, Callout (portal). Video: inline Media / YouTube–Vimeo panel under the toolbar.

`@payloadcms/richtext-lexical` remains only so public `RichText` can still render old Lexical JSON until pages are re-saved as HTML.

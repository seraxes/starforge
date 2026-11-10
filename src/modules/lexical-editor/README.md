# product:lexical-editor

Optional **Payload Lexical** pack. Default Starforge editing is TipTap (`product:rich-editor`). Lexical stays available after pages are converted, for installs that prefer it. It is off unless the installer chooses it.

## Why it exists

- Keep `@payloadcms/richtext-lexical` available without being the default CMS body editor
- Export `pagesLexicalEditor` for opt-in Lexical fields
- Site Settings → Modules toggle (`defaultEnabled: false`)

## Imports

```ts
import { pagesLexicalEditor } from '@/modules/lexical-editor/api'
import { isLexicalEditorEnabled } from '@/modules/lexical-editor/api.server'
```

Public `RichText` still accepts legacy Lexical JSON so published pages do not blank when this module is off.

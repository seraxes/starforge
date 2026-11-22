# product:lexical-editor

Layer: site pack

Status: built-default-off

## Owns

Optional **Payload Lexical** editor pack. Keeps `@payloadcms/richtext-lexical` available without being the default body editor (default is TipTap via `product:rich-editor`). Exports `pagesLexicalEditor` for opt-in Lexical fields. Settings route shim under admin. No `sf_*` tables. `defaultEnabled: false` — off unless the installer chooses it. Do not delete Lexical once TipTap migration is done.

## Consumes

None in `requires` / `optionalRequires`. Depends on `@payloadcms/richtext-lexical` as a library.

## Public door

- `@/modules/lexical-editor/api` — `pagesLexicalEditor`
- `@/modules/lexical-editor/api.server` — `LEXICAL_EDITOR_MODULE_ID`, `isLexicalEditorEnabled`

## Admin surfaces

- `/admin/lexical-editor/settings` (route shim)
- Toggle: Site Settings → Modules (`defaultEnabled: false`)
- ACL: none beyond module toggle / settings route

## Boot and jobs

None.

## Known gaps

- Default editing stays TipTap (`product:rich-editor`); Lexical is legacy / opt-in.
- Public `RichText` still accepts legacy Lexical JSON so published pages do not blank when this module is off.

## Tests

None registered in `test:unit` for this pack.

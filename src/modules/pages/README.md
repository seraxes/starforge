# product:pages

Editorial pages for the public site (phase 3b). Not Core. Payload `pages` is not registered. `/cms` stays for the Users bridge until phase 4.

## Owns

Brochure pages, drafts, the last 20 version snapshots, `/admin/pages`, and page tags (`sf_pages`, `sf_pages_tags`, `sf_pages_page_tags`, `sf_pages_versions`). Slug is shared across locales, including `home`. Title, body, and SEO copy use LocaleInput and `data/content-locales/{locale}/pages/{id}.json`. The default-locale scalars stay on the row. Body is TipTap HTML.

## Consumes

`product:rich-editor` (TipTap `preset="full"`, `sanitizeRichHtml` on save). `product:media` (`meta.mediaId` text, MediaPicker). Core Nav binds a page id. Core locale host. `PageReadsPort` stays the only public read API for published slug, draft preview, search, and sitemap summaries. Pack off → empty reads.

## Public door

`@/modules/pages/api` (types). `@/modules/pages/api.server` (`createPagesPageReads`, nav page list / slug lookup / legacy id lookup, save). Core does not import this pack. `getPageReads()` and Nav load the `pages-api` door from the generated registry when the module is enabled.

## Nav ids

Binds store the text page id (uuid). `npm run db:migrate` rewrites stored Payload numbers using `sf_pages.payload_legacy_id`. This pack does not call `getPayload()`.

## Migration

`0046_pages_payload_cutover` adds `payload_legacy_id` and `sf_pages_versions`. `scripts/db-migrate.mts` then copies `payload.pages`, page locales, page tags, and the last 20 Payload versions. Lexical JSON bodies become HTML once. Locale files are written once (`payload_content_copied_at`). Re-runs skip rows already copied.

## Shipped

List (status, tag, updated filters), tag add/rename/delete, create, edit, delete, save draft, publish, and version restore on `/admin/pages`. Preview links to `/{locale}/preview/{slug}` and back to `/admin/pages/{id}`.

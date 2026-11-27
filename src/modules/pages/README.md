# product:pages

Layer: site pack

Status: shipped

Editorial pages for the public site. Not Core. The content manager is this pack. `/cms` redirects to `/admin`.

## Owns

Brochure pages, drafts, the last 20 version snapshots, `/admin/pages`, page categories, and page tags — tables `sf_pages`, `sf_pages_categories`, `sf_pages_tags`, `sf_pages_page_tags`, `sf_pages_versions`. Status is `draft`, `published`, or `unpublished`. Only `published` is public. Each page stores `created_at`, `published_at` (stamped on publish, kept after unpublish), `created_by_user_id`, and `published_by_user_id` (plain `sf_users` ids, no cross-schema FK). Names resolve at read time. One category per page (`category_id`). Tags stay many-to-many. Slug is shared across locales, including `home`. Title, body, and SEO copy use LocaleInput and `data/content-locales/{locale}/pages/{id}.json`. The default-locale scalars stay on the row. Body is TipTap HTML.

**Shipped admin:** List (status, category, tag, updated filters; 10/20/50 per page; created, published, creator, publisher columns), category column, sticky tags side panel, `/admin/pages/categories` (add / edit / delete), tag add/rename/delete, create, edit, delete, save draft, publish, unpublish, and version restore on `/admin/pages`. Preview links to `/{locale}/preview/{slug}` and back to `/admin/pages/{id}`. Public pages show the created and published dates with creator and publisher names.

**Nav ids:** Binds store the text page id (uuid). `npm run db:migrate` rewrites stored numeric page ids using `sf_pages.payload_legacy_id`.

**Migration:** `0046_pages_payload_cutover` adds `payload_legacy_id` and `sf_pages_versions`. `scripts/db-migrate.mts` then copies `payload.pages`, page locales, page tags, and the last 20 Payload versions. Lexical JSON bodies become HTML once. Locale files are written once (`payload_content_copied_at`). Re-runs skip rows already copied.

## Consumes

- **`product:rich-editor`** — TipTap `preset="full"`, `sanitizeRichHtml` on save
- **`product:media`** — `meta.mediaId` text, MediaPicker
- **`product:social`** (`optionalRequires`; via `loadModuleDoor('social-api-server')` / soft-import) — after a successful save with `status=published`, Pages calls `publishActivity` (`page.published`) with a title / href / meta-media snapshot. Public CMS pages soft-mount Social’s shared comment controls (`HostConversationMount`); Social off → no form and no error. Pages exposes `viewerMayAccessPageConversation` / `viewerMayModeratePageConversation` on `pages-api` for Social’s host gates. No static import of Social store / schema / actions.
- Core Nav binds a page id; Core locale host
- `PageReadsPort` stays the only public read API for published slug, draft preview, search, and sitemap summaries. Pack off → empty reads

## Public door

- `@/modules/pages/api` — `PAGE_VERSION_KEEP`, `isPageStatus`
- `@/modules/pages/api.server` — `createPagesPageReads`, `deletePage`, `findNavPageByLegacyId`, `findNavPageBySlug`, `findPageById`, `findPageBySlug`, `listNavPageOptions`, `listPages`, `loadPageLocaleMaps`, `savePage`

Core does not import this pack. `getPageReads()` and Nav load the `pages-api` door from the generated registry when the module is enabled. Door id: `pages-api` → `api.server`.

## Admin surfaces

- `/admin/pages`, `/admin/pages/categories`, `/admin/pages/new`, `/admin/pages/[pageId]`
- Preview: `/{locale}/preview/{slug}`
- ACL area: `pages`

## Boot and jobs

None.

## Known gaps

- One-shot Payload cutover migration already shipped; leftover Payload schema cleanup is migrate’s job

## Tests

- `publish-social-activity.test.ts` — activity card notify after publish (door soft-fail; registered in `test:unit`).

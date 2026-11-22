---
kind: reference
last_verified: 2026-11-22
---
# Redirects and archive

Sources: `src/modules/redirects/csv.ts`, `src/modules/redirects/store.ts`, `src/modules/redirects/actions.ts`, `src/modules/redirects/admin/redirects-manager.tsx`, `src/modules/redirects/schema.ts`.

## CSV import (in-repo)

`product:redirects` stores rows in `sf_redirects`. Admin UI: `/admin/redirects` (CSV file input, accept `.csv` / `text/csv` / `text/plain`).

Server path: `importRedirectsCsvAction` → `importRedirectsFromCsv` → `parseRedirectCsv`.

### Header

Required columns (order flexible, names case-insensitive):

`from,to,status,enabled,note`

### Row rules (from `csv.ts`)

| Column | Behavior |
| --- | --- |
| `from` | Normalized from-path (e.g. `/old-page`); required; unique in DB |
| `to` | Normalized to-path or absolute `http(s)` URL; required; must differ from `from` |
| `status` | Empty → `301`; else `301` \| `302` \| `307` \| `308` |
| `enabled` | Empty → `true`; truthy `1/true/yes/y/on`; falsey `0/false/no/n/off` |
| `note` | Trimmed, max 200 chars |

Invalid data rows are **skipped** (counted). Matching `fromPath` **updates** to/status/enabled/note (upsert — no duplicate source paths).

## Old-URL map

TODO(owner): complete old-URL → new-URL map for Airsoft Nexus (or site-specific CSV contents).

## Archive location

TODO(owner): where the old site (past events and non-migrated content) remains archived / read-only.

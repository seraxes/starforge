# product:audit

Layer: site pack

Status: built-default-off

## Owns

Optional company audit **reader**. Filtered UI at `/admin/audit` when this pack is on. CSV export at `/api/admin/audit/export`. Policy for which day-to-day admin actions get logged (pages, events, media deletes, form changes, staff mark-paid) alongside Core. **Does not own** the log table or writer — Core `sf_admin_audit` and `recordAdminAudit` are the only table and writer. Do not add a second audit table. Host security rows (role, group, disable, CMS access, module on/off, redirects, environment save, ACL level changes) record even when this pack is off. Rows are action keys and target ids; environment saves stay a fixed fact with no key names or values. Payment “audit reason” text stays on the order, not in this log. Door: `audit-log` → `AuditLogPanel`. `defaultEnabled: false`.

## Consumes

None in `requires` / `optionalRequires`. Reads Core `sf_admin_audit` via Core audit helpers.

## Public door

none

## Admin surfaces

- `/admin/audit` — filtered reader (append-only; no delete)
- `/api/admin/audit/export` — CSV export
- ACL area: `audit` (`admin.audit` **view** opens the log; no edit/manage actions on the log itself)
- Pack off: `/admin/audit` is developer-admin only, under Settings
- Pack on: link moves under Users, beside ACL; app admins can open it; a group needs **view** on `admin.audit`

## Boot and jobs

None.

## Known gaps

- Opt-in only until a company turns it on.
- Existing checked ACL cells were migrated to **manage**, which still includes view.

## Tests

None under `src/modules/audit/` in `test:unit`. Related Core: `src/core/audit/audit.test.ts`.

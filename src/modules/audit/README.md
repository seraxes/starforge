# product:audit

Optional company audit reader. It sits next to Users → ACL.

## Owns

- The filtered reader at `/admin/audit` when this pack is on
- CSV export at `/api/admin/audit/export`
- The decision to record day-to-day admin activity (pages, events, media deletes, form changes, staff mark-paid)

## Does not own

- The log itself. Core `sf_admin_audit` and `recordAdminAudit` are the only table and the only writer. Do not add a second audit table.
- Host security rows (role, group, disable, CMS access, module on/off, redirects, environment save, ACL level changes). Those record even when this pack is off.
- Secrets. Rows are action keys and target ids. Environment saves stay a fixed fact with no key names or values. Payment “audit reason” text stays on the order, not in this log.

## Access

- Pack off: `/admin/audit` is developer-admin only, under Settings.
- Pack on: the link moves under Users, beside ACL. App admins can open it. A group needs **view** on `admin.audit` to open it. There is no delete. The log is append-only.

## Levels

View opens the log. The log has no edit or manage actions.

Turn the pack on under Settings → Modules. Existing checked ACL cells were migrated to **manage**, which still includes view.

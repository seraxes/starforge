---
kind: decision
last_verified: 2026-11-22
---
# ACL levels and optional audit

**Date:** 2026-11-16

**Decision:** Admin ACL stays groups-only. Each group grant on an admin resource is a level: `view`, `edit`, or `manage`. Manage includes edit and view. Across a person’s groups, including parent groups, the highest level wins. A legacy checked cell is `manage`. App admins still bypass the matrix. Changing roles, group membership, the matrix, and the environment file stays app-admin.

The company audit log is the optional site pack `product:audit`. It reads the Core table `sf_admin_audit`. It does not add a second table. Host security rows (accounts, groups, ACL levels, module toggles, redirects, environment saves) record whether or not the pack is on. Day-to-day content and commerce rows record only while the pack is on. The log is append-only. Secrets and free-text notes do not go in a row.

**Constraint (one sentence an agent can follow):** Extend `sf_acl_permissions.level` and `recordAdminAudit` / `recordOptionalAudit`; do not add an Access Level entity or a second audit table.

**Files to update:**

- Rule: `.cursor/rules/sf-architecture.mdc`
- Live map: `docs/project-context/docs/architecture-current.md`
- Owner README: `src/modules/audit/README.md`

---
kind: decision
last_verified: 2026-11-22
---
# Decision: staff bypass on member ownership gates

**Date:** 2026-11-21

**Decision:** App admins (including developer-admins) may edit, delete, and use ownership-gated member functions anywhere by default. Pack ACL `admin.<pack>` edit/manage also grants that pack’s staff tools. Staff UI is additive (Edit/Delete does not remove Hide/Block/audience on others’ content).

**Status:** accepted (edit/delete/moderation). Clarified by [2026-11-22-staff-bypass-limits](./2026-11-22-staff-bypass-limits.md): do not read this decision as hiding private front-end content from staff; private-read for moderator/admin/developer is accepted policy with Open work until `canViewPost` grants it.

**Constraint (one sentence an agent can follow):** When a gate is “owner only,” also allow `AccessViewer.isAppAdmin` or `viewerMayAccessAdminResource(viewer, 'admin.<pack>', 'edit')`, and keep member tools on the same ··· menu for staff.

**Files to update:**

- Rule: `.cursor/rules/sf-staff-bypass.mdc`
- Live map: `docs/project-context/docs/architecture-current.md` (Admin ACL row)
- Owner README: `src/modules/social/README.md` (posts/comments staff line)

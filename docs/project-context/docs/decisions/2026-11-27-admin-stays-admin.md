---
kind: decision
last_verified: 2026-11-27
---

**Date:** 2026-11-27

**Decision:** Admin create/edit/moderate stays under `/admin`. Public member editors are separate routes. Shared form fields and actions are allowed; shared page shells and cross-surface redirects after save are not.

**Status:** accepted

**Supersedes:** —

**Constraint (one sentence an agent can follow):** Admin Edit and title links must open an `/admin/…` editor; public keeps its own edit view and both may reuse shared form elements without bouncing between surfaces after save.

**Consequences:**

- Pack admin lists (e.g. Marketplace listings) link to `/admin/<pack>/…/[id]`, not `/[locale]/…/edit`.
- Public `/marketplace/[id]/edit` (and siblings) remain for sellers/members.
- Shared `ListingForm`-style bodies take a surface-specific success/cancel path.

**Verification:** Admin listings title/Edit → `/admin/marketplace/listings/[id]`; rule `.cursor/rules/sf-admin-stays-admin.mdc`.

**Files to update:**

- Rule: `.cursor/rules/sf-admin-stays-admin.mdc`
- Live map: `docs/project-context/docs/architecture-current.md`
- Owner README: `src/modules/marketplace/README.md`
- AGENTS index: `AGENTS.md`

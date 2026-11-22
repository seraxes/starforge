---
kind: decision
last_verified: 2026-11-22
---
# Decision: requires and optionalRequires

**Date:** 2026-11-15

**Decision:** A pack may import another pack's public door only if `requires` or `optionalRequires` names that id.

**Constraint (one sentence an agent can follow):** Manifest edges are `requires` plus `optionalRequires`; both count for a legal public-door import.

**Files to update:**

- Rule: `.cursor/rules/sf-architecture.mdc` (Install section)
- Live map: `docs/project-context/docs/architecture-current.md` (Installer / Docs)
- Glossary: `docs/project-context/docs/glossary.md` (`requires` term — CONFLICT removed)
- Owner README: n/a (host rule, not one module)

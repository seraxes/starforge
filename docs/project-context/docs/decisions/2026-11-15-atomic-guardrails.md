---
kind: decision
last_verified: 2026-11-22
---
# Decision: atomic guardrails

**Date:** 2026-11-15

**Decision:** Always-apply atomic guardrails: no new module-boundary allowlist rows; cross-pack imports only via public doors with manifest edges; schema ownership with owner-only additive ALTER; fail-closed authz; money/webhook idempotency; close boundary work only after `npm run check:atomic`.

**Constraint (one sentence an agent can follow):** Do not expand the boundary allowlist; use public doors + manifest edges; own your schema; fail closed; idempotent money/webhooks; run `npm run check:atomic` before closing boundary work.

**Files to update:**

- Rule: `.cursor/rules/sf-atomic-guardrails.mdc`
- Live map: `docs/project-context/docs/architecture-current.md` (Manifest edges / Docs)
- Owner README: n/a (host rule, not one module)
- Scripts: `package.json` (`check:atomic` → `verify:module-boundaries`)

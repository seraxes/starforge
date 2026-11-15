# Decision: who adds an online payment gateway

**Date:** 2026-11-15

**Decision:** A developer ships an online gateway as a Core adapter in the build. An admin enables that method and pastes keys. An admin does not add a gateway.

**Constraint (one sentence an agent can follow):** Add `src/core/payments/<id>.ts`, import it from `register-online.ts`, and ship the build. Do not add an upload-a-gateway screen.

**Files to update:**

- Rule: `.cursor/rules/sf-payments-module.mdc`
- Live map: `docs/project-context/docs/architecture-current.md` (accepted transitions, ports)
- Owner README: `src/modules/payments/README.md` (Add an online gateway)

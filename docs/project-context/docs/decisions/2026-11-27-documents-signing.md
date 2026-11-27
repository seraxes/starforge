---
kind: decision
last_verified: 2026-11-27
---
# Decision: contract signing belongs to Documents

**Date:** 2026-11-27

**Decision:** Online contract management and signing belong to `product:documents`. A signature provider is a Core adapter. There is no `product:signatures` and no `product:contracts`.

**Status:** accepted

**Supersedes:** any plan line that would put DocuSign, or another signing service, in its own module or inside Onboarding.

**Constraint (one sentence an agent can follow):** Keep the contract template, the subject link, the envelope status, and the signed `mediaId` in Documents; add a provider as `src/core/signatures/<id>.ts`; do not scaffold Documents until a person file and a car file need the same renderer.

**Consequences:**

- Documents slices 1–4 stay list, bind, render, and admin. Signing is slice 5 of that pack.
- Media keeps the PDF bytes. Onboarding keeps valid-until on the contract slot. Forms keeps the answers. Payments keeps invoices.
- While a link is `draft` or `sent`, a second render updates that one link. A `signed` link is not overwritten. A replacement is a new generation after void.
- The pack stays parked. This decision does not move it into the build queue.

**Verification:** [documents-pack-plan](../documents-pack-plan.md), [documents-build-spec](../documents-build-spec.md), and the parked Documents line on [architecture-current](../architecture-current.md).

**Files to update:**

- Rule: n/a until slice 1 (the ownership test already says one owner; the owner doc is the pack plan until a README exists)
- Live map: `docs/project-context/docs/architecture-current.md`
- Owner README: none until scaffold. Pack plan is the owner doc while the pack is parked

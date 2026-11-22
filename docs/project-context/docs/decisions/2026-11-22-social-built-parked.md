---
kind: decision
last_verified: 2026-11-22
---
# Decision: Social built but parked — freeze vs cleanup vs continue

**Date:** 2026-11-22

**Decision:** Social is in launch scope and is to be finished. It is not frozen and it is not parked behind Ads. Finish Social before starting Ads. Ads is an advanced module (not Core, not base); when built it depends on Social, Email Manager, Forms, Subscriptions, and Payments because an ad posts into Social. Do not create `product:ads` in the decision-recording change.

**Status:** accepted

**Supersedes:** Any live-map or brief reading that parks Social enablement behind Ads or freezes Social until Ads ships.

**Constraint (one sentence an agent can follow):** Treat `product:social` as in-scope work to finish before starting Ads; keep `defaultEnabled: false` until Social Open work rows that block enablement close; do not scaffold `product:ads` ahead of that.

**Consequences:**

- Build queue Active / Next product: finish Social, then Ads.
- Social product slices may continue; default-off remains until enablement blockers close.
- Ads placement and requires are recorded for when that pack is built — no Ads module lands in this change.

**Verification:** Live map Build queue + Social section; `src/modules/social/manifest.ts` `defaultEnabled`; no `src/modules/ads` from this decision; Social Open work rows list remaining enablement blockers.

**Facts (current):**

- Slices 1–22 are in tree (`src/modules/social/manifest.ts`, pack README).
- `defaultEnabled: false`.
- Brief: [social-module-standing](../social-module-standing.md).

**Choice (recorded):**

### Posture — **P3 — Continue**

Further Social product work may land while default-off; live map must say Social is in scope to finish, not parked behind Ads.

### Enablement blockers still open (subset that remains after related decisions)

| ID | Blocker | Standing |
| --- | --- | --- |
| **E1** | Media bytes / attach access vs wider audience | Accepted model; implementation Open work ([media-access-model](./2026-11-22-media-access-model.md)) |
| **E2** | Rate limits on Social member writes (Core RateLimiter) | Open |
| **E3** | Comments/reports ownership | Accepted ([comments-reports-ownership](./2026-11-22-comments-reports-ownership.md)) |
| **E4** | Media access model | Accepted; code not yet compliant |
| **E5** | Social dependency floor | Accepted ([social-dependency-floor](./2026-11-22-social-dependency-floor.md)) |
| **E6** | Manifest `optionalRequires` particle id `form` keep or drop | Still Open |
| **E7** | Launch-scope includes Social | Accepted — Social on for Airsoft Nexus ([launch-scope](./2026-11-22-launch-scope.md)) |

**Files to update:**

- Rule: none unless a Social-specific law is added later
- Live map: Build queue + Social section + Open work
- Owner README: `src/modules/social/README.md`

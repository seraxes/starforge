---
kind: decision
last_verified: 2026-11-22
---
# Decision: comments / reports ownership (Social vs future packs)

**Date:** 2026-11-22

**Decision:** Social owns the comments engine and likes. A page or an event may turn on a conversation that uses that engine only when Social is installed and enabled. Do not create `product:comments` or `product:reports`. Reports stay in Social. Do not build the event conversation in the decision-recording change.

**Status:** accepted

**Supersedes:** Archive brief language that assumed future `product:comments` / `product:reports` packs for page/event/listing threads.

**Constraint (one sentence an agent can follow):** Keep comments, likes, and reports in `product:social` (`sf_social_*`); do not scaffold `product:comments` or `product:reports`; non-feed surfaces may opt into Social’s conversation engine only when Social is on.

**Consequences:**

- Feed tables stay in Social; no shared comments/reports pack ids.
- Pages / Events conversation UI is a later Social-consume slice, not a new pack.
- Archive [core-finish-instructions](../../../archive/core-finish-instructions.md) naming of future comments/reports packs is historical only.

**Verification:** Social schema still owns `sf_social_comments`, `sf_social_reports`, and reaction/like tables; no `product:comments` / `product:reports` manifests; live map and Social README match.

**Facts (current) — unchanged:**

- Social owns `sf_social_comments` and `sf_social_reports` for feed posts (optional `commentId` on reports).
- Those tables stay in Social.

**Choice (recorded):** **R4 — Neither pack.** No `product:comments` / `product:reports`. Non-feed surfaces that need a conversation use Social’s engine when Social is installed and enabled.

**Out of scope for this decision:** migrating Social’s tables; rewriting Social’s comment/report APIs; building the event conversation UI.

**Files to update:**

- Rule: none (no new pack id); ownership prose in Social README
- Live map: Open work / Accepted transitions comments row closed as decided
- Owner README: `src/modules/social/README.md`

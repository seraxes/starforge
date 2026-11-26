---
kind: decision
last_verified: 2026-11-26
---
# Decision: Chat, Shop, and Stream

**Date:** 2026-11-26

**Decision:** Chat and Shop are advanced packs built after Marketplace. Live video is part of Social. There is no `product:stream`.

**Status:** accepted

**Supersedes:** the launch-scope wording that lists Stream as its own absent pack, and any plan line that keeps live video in `product:stream`. Chat and Shop stay unbuilt until Marketplace’s commerce schema is in progress or done; they are not ahead of Marketplace.

**Constraint (one sentence an agent can follow):** Do not add `product:stream`; live video belongs to `product:social`. Do not start Chat or Shop before Marketplace.

**Consequences:**

- Queue: Social polish, then Marketplace, then Chat and Shop. Ads stays parked until after Marketplace.
- Social owns live video. The current Social polish slices do not add a live-ingest stack; they also do not reserve that job for another pack.
- Shop remains the owner of SKUs, inventory, and shipping when it is built. Payments still owns the cart.

**Verification:** [architecture-current](../architecture-current.md) build queue, `src/modules/social/README.md`, `src/modules/social/manifest.ts`.

**Files to update:**

- Rule: n/a (queue and ownership live on the map and the Social README)
- Live map: `docs/project-context/docs/architecture-current.md`
- Owner README: `src/modules/social/README.md`

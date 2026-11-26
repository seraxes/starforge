---
kind: decision
last_verified: 2026-11-26
---
# Decision: base vs advanced

**Date:** 2026-11-26

**Decision:** A product pack that depends only on Core is base. A product pack whose manifest `requires` another module is advanced. Site packs are not reclassified by this test. Hero is not a module.

**Status:** accepted

**Supersedes:** the layer test “a base pack may require another base pack, and that does not make it advanced.”

**Constraint (one sentence an agent can follow):** Classify a product pack as base only when it does not `require` another module; if it `requires` another module, it is advanced. Do not retag manifest `layer` in a feature slice.

**Consequences:**

- Media is the in-tree base product pack (no module `requires`).
- Forms, Rich editor, Email Manager, Payments, Profiles, and Maps are advanced under this test because each `requires` another module. Events, Subscriptions, Social, Ads, and Marketplace stay advanced.
- Marketplace is advanced even while its stub `requires` is empty. It is a domain product and will `require` Payments when built.
- Maps (`product:maps` / TacMap) is in progress. Stations, BLE beacons, and `apps/asn-capacitor` stay parked.
- Marketplace commerce schema is next after Social polish. Ads stays parked until after Marketplace.
- Manifest `layer` still drives boot order (base, then site, then advanced). Packs this rule classes as advanced may still say `layer: 'base'`. `product:pages` (site) `requires` the rich editor, so retagging that pack to `advanced` would make a site pack depend on a later boot layer. Retag is open work, not part of this decision’s code change.

**Verification:** This file, the module class table on [architecture-current](../architecture-current.md), and each pack manifest `requires`. Boot check: `src/core/modules/boot-order.ts` (`BOOT_LAYER_ORDER`).

**Files to update:**

- Rule: `.cursor/rules/sf-architecture.mdc`
- Live map: `docs/project-context/docs/architecture-current.md`
- Owner README: Media, Forms, Rich editor, Email Manager, Payments, Profiles, Maps, Marketplace

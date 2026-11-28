---
kind: reference
last_verified: 2026-11-28
---
# Decision: Fleet owns live vehicle positions

**Date:** 2026-11-28

**Decision:** Last-known courier / fleet vehicle positions (Ecofleet, Mtrack, optional phone push) live in **Fleet**. TacMap (`product:maps`) stays event same-team GPS only. Both use Core **MapProvider** (tiles) and **RealtimePort** (fan-out). Telematics vendors are **adapters behind Fleet**, same pattern as payment gateways behind Payments.

**Status:** superseded

**Supersedes:** —

**Superseded by:** [2026-11-28-maps-vs-tacmap](./2026-11-28-maps-vs-tacmap.md)

**Constraint (one sentence an agent can follow):** Do not follow this file. Follow [2026-11-28-maps-vs-tacmap](./2026-11-28-maps-vs-tacmap.md): Maps owns the live map and last-known positions; Fleet adapters push vehicle positions through the Maps door.

**Consequences:**

- The Fleet-owned map UI and `fleet:` position store in the original text are withdrawn.
- [fleet-live-map-plan](../fleet-live-map-plan.md) is the adapter plan under the Maps decision.
- This decision was never accepted, so the ownership rule was not updated from it.

**Verification:** Agents cite `2026-11-28-maps-vs-tacmap`, not this file, for live GPS ownership.

**Files to update:** none from this file. Acceptance work lives on the superseding decision.

## Related

- [2026-11-28-maps-vs-tacmap](./2026-11-28-maps-vs-tacmap.md)
- [fleet-live-map-plan](../fleet-live-map-plan.md)
- [maps-product-plan](../maps-product-plan.md)

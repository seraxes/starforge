---
kind: reference
last_verified: 2026-11-28
---
# Decision: Maps product, TacMap mode

**Date:** 2026-11-28

**Decision:** `product:maps` is branded **Maps**. The manifest id stays `product:maps`. **TacMap** is a per-map mode in that module: extra layers and editing (image overlays, icons, labels, lines, shapes, zones). It is not a second pack and not a Hero module. Hero (ASN) may add milsim skin, beacon SKUs, and a Capacitor client on the same APIs.

Live location is a **follow set** of trackable ids, optionally naming a Core group id. Maps does not own a second group catalog. A fleet follow map and an event room are separate map records. Phone positions require consent and follow-set (or, until follow sets ship, same-team roster) membership. Vehicle positions are written only by a trusted pack door (Fleet adapters). Shipped point/KML overlays stay visible in default mode.

Everyone / friends / selected live shares stay parked. Follow sets are the live-location model.

**Status:** accepted

**Supersedes:** [2026-11-28-fleet-live-positions](./2026-11-28-fleet-live-positions.md)

**Constraint (one sentence an agent can follow):** Keep TacMap as a per-map mode inside `product:maps`; store follow sets that reference Core groups; accept vehicle positions only from a trusted pack door; do not rename the manifest id to TacMap.

**Consequences:**

- Product and action plans: [maps-product-plan](../maps-product-plan.md), [maps-tacmap-action-plan](../maps-tacmap-action-plan.md).
- Fleet telematics push into Maps when Fleet is unparked. Fleet `optionalRequires` Maps. Maps does not `require` Fleet. No Fleet-owned live-map UI.
- Open work “Rename `product:maps` to TacMap” is closed.
- Live map and pack README updated in the acceptance change. Follow sets and TacMap mode are accepted ownership; they are not shipped code yet. Event rooms still use same-team roster ACL until the follow-set slice.
- `.cursor/rules/sf-module-ownership.mdc` still needs the maps bullet. Plan mode cannot edit that file. Add under Ownership test: **maps** — live map, follow sets, last-known positions, TacMap mode. Fleet adapters push vehicle positions through the Maps door. Maps does not require Fleet. Do not rename `product:maps` to TacMap. Do not put TacMap in Hero.

**Verification:** No manifest id rename. TacMap is documented as a mode on a map record. Vehicle ingest is not a browser route. The ownership rule names maps once the bullet above is in `sf-module-ownership.mdc`.

**Files updated:**

- Live map: [architecture-current](../architecture-current.md)
- Owner README: [src/modules/maps/README.md](../../../../src/modules/maps/README.md)

**Still to write:** [sf-module-ownership.mdc](../../../../.cursor/rules/sf-module-ownership.mdc)

## Related

- [maps-product-plan](../maps-product-plan.md)
- [maps-tacmap-action-plan](../maps-tacmap-action-plan.md)
- [maps-live-tactical](../maps-live-tactical.md)
- [fleet-live-map-plan](../fleet-live-map-plan.md)

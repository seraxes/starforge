---
kind: reference
last_verified: 2026-11-26
---
# product:warehouse — pack plan (later)

**Status:** Later pack. **Not in the first build.** Parked with the PrimeOne family — not on the live queue. Live map: [architecture-current](./architecture-current.md). Do not scaffold.  
**Placement:** Advanced module (`product:warehouse`) when built. Not Core.  
**Family index:** [primeone-pack-plans](./primeone-pack-plans.md).

## Ownership (planned)

| Owns | Consumes |
| --- | --- |
| SKUs, quantity on hand, assignment to a Core user, stocktakes | **Core users** (assignment target) |
| | **Core ACL** (`admin.warehouse`) |
| | Callers such as **fleet** (clothing request may draw stock once this is on) |

**Rule of thumb:** Warehouse owns stock math. Phones and fuel cards may stay fields on the car in Fleet. Clothing requests live in Fleet until this pack can draw stock.

## Notes

- Does not require Onboarding or Fleet. Fleet may call it later via the public door.
- Until this pack exists, clothing requests stay in Fleet with no stock draw.
- Build only when a second caller needs those rows (family build order step 10).

## Explicit non-goals

| Out | Why |
| --- | --- |
| Shop / marketplace catalog and shipping | Later `product:shop` / Marketplace |
| Payments cart for stock sales | `product:payments` when commerce needs it |
| Starting in the first Onboarding / Fleet build | Later |

## Related

- Family index: [primeone-pack-plans](./primeone-pack-plans.md)
- Fleet interim: [fleet-pack-plan](./fleet-pack-plan.md)

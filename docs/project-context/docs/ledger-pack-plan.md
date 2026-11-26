---
kind: reference
last_verified: 2026-11-26
---
# product:ledger — pack plan (later)

**Status:** Later pack. **Not in the first build.** Parked with the PrimeOne family — not on the live queue. Live map: [architecture-current](./architecture-current.md). Do not scaffold.  
**Placement:** Advanced module (`product:ledger`) when built. Not Core.  
**Family index:** [primeone-pack-plans](./primeone-pack-plans.md).

## Ownership (planned)

| Owns | Consumes |
| --- | --- |
| Internal money **lines** (amount, in or out, date, source pack, receipt as Media id) | **media** (receipt bytes) |
| | **Core ACL** (`admin.ledger`) |
| | Callers such as **fleet** (may post the home-run figure) |

**Rule of thumb:** Posting a line does **not** pay anyone. Checkout, VAT, and invoices stay in **`product:payments`**. This is an internal ledger, not a second cart or gateway.

## Notes

- Does not require Onboarding or Fleet. Fleet may call it later via the public door.
- Until this pack exists, Fleet keeps the home-run figure on the claim and does not treat it as a payout.
- Build only when a second caller needs those rows (family build order step 10).

## Explicit non-goals

| Out | Why |
| --- | --- |
| Cart, gateway, VAT, fiscal invoice | `product:payments` |
| Payroll or bank transfer engine | Out of scope for this pack |
| Starting in the first Onboarding / Fleet build | Later |

## Related

- Family index: [primeone-pack-plans](./primeone-pack-plans.md)
- Fleet interim: [fleet-pack-plan](./fleet-pack-plan.md)
- Commerce: [payments-cart-plan](./payments-cart-plan.md)

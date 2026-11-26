---
kind: reference
last_verified: 2026-11-26
---
# PrimeOne → Starforge — coverage plan

**Status:** Inventory and build specs are written. **Parked** for implementation — not on the live product queue. Active stays Social polish → Marketplace → Messages (Chat) → Ads for ASN 2.0 base / Hero. Live map: [architecture-current](./architecture-current.md).  
**Do not** scaffold `src/modules`, start schema, admin UI, or manifests from these docs. Specs exist ahead of that queue by an explicit docs-only override; scaffolding still waits.  
**Ownership:** Pack plans win — [primeone-pack-plans](./primeone-pack-plans.md) plus [onboarding](./onboarding-pack-plan.md) / [fleet](./fleet-pack-plan.md) / [documents](./documents-pack-plan.md) / [ledger](./ledger-pack-plan.md) / [warehouse](./warehouse-pack-plan.md).  
**Live source (read-only):** PrimeOne repo `com_primeone_drivers` + `com_primeone_fleet` (and related modules/plugins listed in the inventories).  
**Shape:** Pack-plan style like [ads-pack-plan](./ads-pack-plan.md). Inventory tables: surface → owner like [asn-modules-wireframe](./asn-modules-wireframe.md).

## States

| State | Allowed now? |
| --- | --- |
| Coverage plan + inventories (this phase) | Yes |
| Build specs (`onboarding-build-spec`, `fleet-build-spec`, `documents-build-spec`) | Written. Docs-only override — implementation still waits until P1 is unparked |
| Scaffold `src/modules/{onboarding,fleet,documents,…}`, schema, admin UI, manifests | No — after Social → Marketplace → Messages → Ads, when P1 is unparked |

P1 packs stay **Parked** on the live map. Inventory work does not move them into Active.

## Slice checklist

| # | Slice | Status |
| --- | --- | --- |
| 1 | Coverage plan (this file) | This chat |
| 2 | Inventory drivers — [primeone-inventory-drivers](./primeone-inventory-drivers.md) | This chat |
| 3 | Inventory fleet — [primeone-inventory-fleet](./primeone-inventory-fleet.md) | This chat |
| 4 | Inventory crosscut — [primeone-inventory-crosscut](./primeone-inventory-crosscut.md) | This chat |
| 5 | Onboarding / Fleet / Documents **build specs** | Written, still parked — [onboarding](./onboarding-build-spec.md), [fleet](./fleet-build-spec.md), [documents](./documents-build-spec.md) |
| 6 | Close loop — every inventory row has Spec link + First build decided; reconcile imports | Later |

## Inventory row contract

Every inventory table uses these columns:

| Column | Meaning |
| --- | --- |
| **Live surface** | What exists on the Joomla site / in component code |
| **In use?** | `yes` when the code path is clearly the live product surface; `unknown` (ops) when code alone cannot prove ops still uses it; `no` for dead stubs / deprecated OSB leftovers. Never invent `yes`. |
| **Starforge owner** | One of: `onboarding` · `fleet` · `documents` · `page` · `core` · `forms` · `media` · `email-manager` · `profiles` · `ledger-later` · `warehouse-later` · `drop` |
| **First build?** | `yes` / `no` / `later` against the family build order in [primeone-pack-plans](./primeone-pack-plans.md) |
| **Proof** | Evidence path under the PrimeOne repo (relative), or “absent in code” |
| **Spec link** | Build-spec anchor when written; until then `—` or the owning pack plan |

### Owner rules (do not invent parallels)

| Concern | Owner |
| --- | --- |
| Training (checklist, sittings, trainer calendar, reports/PDF) | `onboarding` — no second training pack |
| Routes + attendance (clock-in) | `fleet` — MapProvider tiles, not TacMap |
| Fact map | Fleet consumes Onboarding provider only — no Onboarding table reads |
| Form schemas | `forms` |
| File bytes | `media` |
| Mail send / templates | `email-manager` |
| Shared PDF/subject bind | `documents` (when both person and car need the same renderer) |
| Home / Coming up / Analytics | `page` — store nothing |
| Home-run money line / clothing stock | `ledger-later` / `warehouse-later` until then stay interim on Fleet |

## Inventories

| Doc | Source |
| --- | --- |
| [primeone-inventory-drivers](./primeone-inventory-drivers.md) | `com_primeone_drivers` (+ driver modules/plugins) |
| [primeone-inventory-fleet](./primeone-inventory-fleet.md) | `com_primeone_fleet` |
| [primeone-inventory-crosscut](./primeone-inventory-crosscut.md) | Grants, email, storage, pages, exports; collision resolution |

## Related

- Family index: [primeone-pack-plans](./primeone-pack-plans.md)
- Live map: [architecture-current](./architecture-current.md)
- Review draft (history): [primeone-for-claude](../../review/primeone-for-claude.txt)

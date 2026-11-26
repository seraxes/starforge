---
kind: reference
last_verified: 2026-11-26
---
# PrimeOne inventory — crosscut

**Coverage:** [primeone-coverage-plan](./primeone-coverage-plan.md). Resolves owner collisions against [primeone-pack-plans](./primeone-pack-plans.md) and the per-pack plans.  
**Drivers / fleet detail:** [primeone-inventory-drivers](./primeone-inventory-drivers.md), [primeone-inventory-fleet](./primeone-inventory-fleet.md).

## Grants / groups

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Core users / usergroups / view levels | yes | core | yes | Joomla `#__users`, `#__usergroups`, `#__user_usergroup_map` | [primeone-pack-plans](./primeone-pack-plans.md) |
| Driver States as usergroup children under parent | yes | onboarding | yes | Drivers admin `states`; phase via group membership | [onboarding-pack-plan](./onboarding-pack-plan.md) |
| Drivers ACL: manage / status / profile / trainer* | yes | onboarding | yes | `com_primeone_drivers/access.xml` | — |
| Fleet ACL: approve / dispatch / book.any / operations | yes | fleet | yes | `com_primeone_fleet/access.xml` | — |
| Vehicle access priority/secondary (not groups) | yes | fleet | yes | `#__primeone_fleet_vehicle_access` | — |
| Hardcoded legacy numeric group ids in SF | no | drop | no | Pack plans forbid; Core ACL grants only | [primeone-pack-plans](./primeone-pack-plans.md) |
| Live mapping of Joomla groups → SF grants | unknown (ops) | core | yes | Needs ops ACL export | — |

## Email

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Drivers invite / reminder / event confirms via `getMailer()` + params | yes | email-manager | yes | Drivers `sendStaffMail` paths; `#__primeone_driver_activity` | — |
| Fleet outbound notification mail | no | email-manager | later | Absent in fleet PHP | — |
| Parallel SMTP inside Onboarding/Fleet packs | no | drop | no | Must use `emitEmailTrigger` | [primeone-pack-plans](./primeone-pack-plans.md) |

## File storage

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| RSForm file fields (person docs) | yes | media / forms | yes | Drivers `replaceDriverFile` / `viewFile` | — |
| Fleet uploads `images/primeone_fleet/` | yes | media | yes | `UploadService.php` | — |
| Vehicle registration / insurance paths | yes | media / documents | yes | `#__primeone_fleet_vehicle_documents` | [documents-pack-plan](./documents-pack-plan.md) |
| Training PDF bytes | yes | onboarding → documents | yes | `TrainingReportPdf.php` (interim pack-local) | [documents-pack-plan](./documents-pack-plan.md) |
| Invoices as Documents subjects | no | drop | no | Invoices stay in Payments | [documents-pack-plan](./documents-pack-plan.md) |

## Pages: Home / Coming up / Analytics

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Driver home tiles (`#__primeone_driver_tiles` + site dashboard) | yes | page | yes | Drivers site `dashboard`; `mod_primeone_drivers_home` | [primeone-pack-plans](./primeone-pack-plans.md) |
| Staff “soon” / procedure filters on drivers list | yes | page / onboarding | yes | Drivers list filters — Coming up precursor | — |
| Unified Coming up page (48h events + tomorrow shifts + faults + sittings) | no | page | later | Described in pack plans / review; not a single live page | [primeone-pack-plans](./primeone-pack-plans.md) |
| Analytics page (same rows over a range) | no | page | later | Not in drivers/fleet components | [primeone-pack-plans](./primeone-pack-plans.md) |
| Second analytics store / report-builder pack | no | drop | no | Pack plans forbid copying other packs’ rows | — |

## Export / reconciliation formats

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Fleet CSV grid (date × vehicle) | yes | fleet | yes | `BookingsModel::buildCsv` | — |
| Fleet XLSX/CSV station roster | yes | fleet | yes | `RosterWorkbook.php` | — |
| Drivers exam roster text export | yes | onboarding | yes | `exportExam` | — |
| Cutover: match exported week before import | unknown (ops) | fleet | later | Ops process; tooling not in component | [primeone-pack-plans](./primeone-pack-plans.md) |
| Migrate OS Services Booking history | no | drop | no | Explicit non-goal | [primeone-pack-plans](./primeone-pack-plans.md) |

## Fact map (cross-pack)

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Name / email from user account | yes | core | yes | `#__users`; Fleet `ActiveDriverService::describe` | — |
| Phone (Drivers / RSForm → Profiles fallback in SF) | yes | onboarding / profiles | yes | Drivers identity; pack-plan fact map | [primeone-pack-plans](./primeone-pack-plans.md) |
| Driver code | yes | onboarding | yes | `#__primeone_driver_codes` | — |
| Station catalog | yes | fleet | yes | Fleet depots. Onboarding stores the chosen id and reads the list from Fleet | [fleet-pack-plan](./fleet-pack-plan.md) |
| Bookable = active status, or vehicle access | yes | onboarding / fleet | yes | Live code is active phase only. Spec adds vehicle access as the other way in | [primeone-pack-plans](./primeone-pack-plans.md) |
| Home-run allow / free km | yes | onboarding | yes | `#__primeone_driver_profile` | — |
| Trainer / Clearquote (writable from Fleet UI) | yes | onboarding | yes | Profile flags; Active Drivers | — |
| Fleet reading Onboarding/RSForm tables directly | no | drop | no | Live: Drivers API only; SF: fact map only | [fleet-pack-plan](./fleet-pack-plan.md) |

## Maps / routes / attendance / events (non-owners)

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Courier routes / stops | no | fleet | later | Not a separate pack; MapProvider not TacMap | [fleet-pack-plan](./fleet-pack-plan.md) |
| Clock-in attendance | no | fleet | later | Not a separate pack | [fleet-pack-plan](./fleet-pack-plan.md) |
| TacMap rooms for courier cars | no | drop | no | Forbidden | [primeone-pack-plans](./primeone-pack-plans.md) |
| Events pack for shifts / ride-alongs | no | drop | no | Shift ≠ ticket; ride-along ≠ public event | [primeone-pack-plans](./primeone-pack-plans.md) |

## Collision resolution (this inventory)

| Collision | Resolution | Pack / map change? |
| --- | --- | --- |
| Training vs separate training pack | Stays **onboarding** | None — already decided |
| Routes / attendance vs separate packs | Stay **fleet** | None — already decided |
| Live booking status `accepted_changed_params` missing from fleet pack plan | Added to [fleet-pack-plan](./fleet-pack-plan.md) status list | Yes — pack plan sharpened (same change) |
| Manager-only shift types `1` / `2` / `regional` / `regional_city` | Documented on fleet pack domain shape | Yes — pack plan sharpened (same change) |
| Online “test” in onboarding plan vs live exam URL | Live = testday + `exam_url` + RSForm; no quiz engine. Keep under **onboarding** / **forms**; do not invent a quiz pack | None — note in drivers inventory |
| Valid-until dates | Not in live drivers schema; first-build **later** slice inside onboarding | None |
| Vehicle logs schema without PHP | **fleet** later (inspections); usage `unknown` | None |
| Clothing stock / home-run payout | Stay interim on **fleet**; **warehouse-later** / **ledger-later** | None |
| Driver home tiles store rows | Tile rows are chrome config → **page**; workflow rules stay **onboarding** | None — matches “pages store nothing” for Coming up/Analytics; tiles are page config, not analytics |
| Live Fleet PHP imports Drivers classes | Replace with Core fact map + Onboarding public door in SF; ownership unchanged | None |
| Forms / Media / Email / Payments / TacMap / Events ownership | Do not fork — inventories assign consume edges only | None |

No boundary moves that would change Active queue or unpark P1.

## Row count

**37** inventory rows in this file (collision table excluded from count).

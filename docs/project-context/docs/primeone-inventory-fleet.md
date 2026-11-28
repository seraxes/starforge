---
kind: reference
last_verified: 2026-11-26
---
# PrimeOne inventory — fleet (`com_primeone_fleet`)

**Coverage:** [primeone-coverage-plan](./primeone-coverage-plan.md). **Ownership:** [fleet-pack-plan](./fleet-pack-plan.md), [primeone-pack-plans](./primeone-pack-plans.md).  
**Live source:** PrimeOne repo, component **v0.15.41**. Paths relative to that repo root.  
**Rules:** Routes + attendance ∈ **fleet**; live car positions are Maps trackables (Fleet adapters push); tiles via Core **MapProvider**; identity via **fact map** only (no Onboarding table reads). Live Joomla uses `DriverDirectory` → Drivers identity API — Starforge replaces that with the fact-map provider.

## Related extensions

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Site + admin `com_primeone_fleet` | yes | fleet | yes | `components/com_primeone_fleet/`, `administrator/components/com_primeone_fleet/` | [fleet-pack-plan](./fleet-pack-plan.md) |
| `media/com_primeone_fleet` CSS/JS | yes | fleet | yes | `media/com_primeone_fleet/` | — |
| `mod_osb_fleet_overview` (legacy OSB) | no | drop | no | `modules/mod_osb_fleet_overview/`; deprecated in PrimeOne review docs | — |
| `mod_osb_history` (legacy OSB) | no | drop | no | `modules/mod_osb_history/` | — |
| Fleet-named plugins | no | drop | no | None under `plugins/**/*fleet*` | — |
| Package zip artifacts | no | drop | no | `packages/com_primeone_fleet/*.zip` | — |

## Screens

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Shift calendar | yes | fleet | yes | `tmpl/calendar/` | — |
| Dispatcher bookings | yes | fleet | yes | `tmpl/bookings/` | — |
| My tours (`myshifts`) | yes | fleet | yes | `tmpl/myshifts/` | — |
| Leave (driver) + admin leaves | yes | fleet | yes | site `tmpl/leave/`; admin `tmpl/leaves/` | — |
| Leave grid (subs) | yes | fleet | yes | `tmpl/leavegrid/` | — |
| Holidays (site + admin) | yes | fleet | yes | `tmpl/holidays/` | — |
| Clothing / equipment requests | yes | fleet | yes | `tmpl/requests/`; `GearController.php` | — |
| Faults + company obstacles (`reports`) | yes | fleet | yes | `tmpl/reports/` | — |
| Company work reports (staff) | yes | fleet | yes | `tmpl/workreports/` | — |
| Active drivers | yes | fleet | yes | `tmpl/activedrivers/` (writes facts via Drivers API) | — |
| Vehicles list / vehicle / depot (site) | yes | fleet | yes | `tmpl/vehicles|vehicle|depot/` | — |
| Admin vehicles / depots / ownvehicle / serviceissues | yes | fleet | yes | admin menus in `com_primeone_fleet.xml` | — |
| Admin configuration / dashboard | yes | fleet | yes | `forms/configuration.xml`; admin `tmpl/dashboard/` | — |
| Live poll (revision stamp → reload) | yes | fleet | yes | `PollController`, `PollService.php`, `media/…/js/poll.js` | — |
| Live GPS map UI | no | fleet | later | Absent; address only on depots | [fleet-pack-plan](./fleet-pack-plan.md) |

## Stations / vehicles / access

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Depots (stations) | yes | fleet | yes | `#__primeone_fleet_depots`; `DepotService.php` | — |
| Depot contacts (`dispatcher` \| `supervisor`) | yes | fleet | yes | `#__primeone_fleet_depot_contacts` | — |
| Vehicles (plate, VIN, fuel card, car phone, …) | yes | fleet | yes | `#__primeone_fleet_vehicles`; `VehicleService.php` | — |
| Vehicle status `available`\|`service`\|`unavailable` | yes | fleet | yes | `BookingRulesService::VEHICLE_*` | — |
| Vehicle docs `registration`\|`insurance` | yes | fleet / media | yes | `#__primeone_fleet_vehicle_documents` | [documents-pack-plan](./documents-pack-plan.md) |
| Own-vehicle singleton + managers | yes | fleet | yes | `#__primeone_fleet_own_vehicle*` | — |
| Access `priority`\|`secondary` (not Joomla groups) | yes | fleet | yes | `#__primeone_fleet_vehicle_access`; `VehicleAccessService.php` | — |
| Depot lat/lng pins | no | fleet | later | Schema has address only | — |

## Shifts / bookings / statuses

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Booking row (day × vehicle × driver) | yes | fleet | yes | `#__primeone_fleet_bookings`; `BookingService.php` | — |
| Status `pending_approval` | yes | fleet | yes | `BookingRulesService::STATUS_PENDING` | — |
| Status `sent` | yes | fleet | yes | `STATUS_SENT` | — |
| Status `accepted` | yes | fleet | yes | `STATUS_ACCEPTED` | — |
| Status `accepted_changed` | yes | fleet | yes | `STATUS_ACCEPTED_CHANGED` | — |
| Status `accepted_changed_params` | yes | fleet | yes | `STATUS_ACCEPTED_CHANGED_PARAMS` (pack plan updated to match) | [fleet-pack-plan](./fleet-pack-plan.md) |
| Status `accepted_no_tour` | yes | fleet | yes | `STATUS_ACCEPTED_NO_TOUR` | — |
| Status `rejected` / `cancelled` / `completed` | yes | fleet | yes | BookingRulesService | — |
| Driver shift types `3tour` \| `4tour` \| `express` | yes | fleet | yes | `SHIFT_3/4/EXPRESS` | — |
| Manager-only types `1` \| `2` \| `regional` \| `regional_city` | yes | fleet | yes | `managerShiftTypes()`; pack plan note | [fleet-pack-plan](./fleet-pack-plan.md) |
| Horizons / lead time / cancel lock / start grid | yes | fleet | yes | `forms/configuration.xml`, `FleetParams.php` | — |
| Bookable gate via Drivers identity | yes | onboarding | yes | `DriverDirectory::assertBookable` (fact map in SF) | [onboarding-pack-plan](./onboarding-pack-plan.md) |

## Leave / rental / home-run / clothing / damage / faults / inspections

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Leave days (user + date) | yes | fleet | yes | `#__primeone_fleet_leave`; `LeaveService.php` | — |
| Holidays `annual`\|`once`\|`easter` | yes | fleet | yes | `#__primeone_fleet_holidays`; `HolidayService.php` | — |
| Company rentals + rental companies | yes | fleet | yes | `#__primeone_fleet_rentals`, `_rental_companies` | — |
| Key-out personal loan (“until Thursday”) | no | fleet | later | Absent in code; pack plan parks | [fleet-pack-plan](./fleet-pack-plan.md) |
| Home-run claim (`pending`\|`approved`\|`denied`; km / free_km / rate_ft) | yes | fleet | yes | `#__primeone_fleet_home_runs`; `HomeRunService.php` | — |
| Home-run allow + free km (identity) | yes | onboarding | yes | Written via `ActiveDriverService` → Drivers profile | — |
| Home-run money as ledger line | no | ledger-later | later | Figure stays on claim | [ledger-pack-plan](./ledger-pack-plan.md) |
| Clothing / equipment types + requests | yes | fleet | yes | `#__primeone_fleet_item_types`, `_item_requests` | — |
| Item statuses `requested`\|`ordered`\|`handed_over`\|`rejected` | yes | fleet | yes | `ItemRequestService.php` | — |
| Clothing stock draw | no | warehouse-later | later | No qty tables | [warehouse-pack-plan](./warehouse-pack-plan.md) |
| Damage cases + files (`report`\|`photo`) | yes | fleet / media | yes | `#__primeone_fleet_damages`, `_damage_files` | — |
| Service issues / faults (types + `submitted`\|`in_progress`\|`done`) | yes | fleet | yes | `ServiceIssueService::TYPE_*`; `#__primeone_fleet_service_issues` | — |
| Company work reports + photos | yes | fleet / media | yes | `#__primeone_fleet_work_reports*` | — |
| Dated inspection checklist UI | no | fleet | later | `#__primeone_fleet_vehicle_logs` (+ photos) exist; **no PHP references** | [fleet-pack-plan](./fleet-pack-plan.md) |
| Uploads under `images/primeone_fleet/` | yes | media | yes | `UploadService.php` | — |

## Routes / attendance / live map

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Ordered route / stops entity | no | fleet | later | Absent from SQL and services | [fleet-pack-plan](./fleet-pack-plan.md) |
| Route drawing (MapProvider) | no | fleet / core | later | No map imports; route lines are not an event room | — |
| Attendance / clock-in on shift | no | fleet | later | Absent | [fleet-pack-plan](./fleet-pack-plan.md) |
| Live GPS / Ecofleet map | no | fleet / maps | later | No geo schema; poll ≠ tracking. Adapters push into Maps | [fleet-live-map-plan](./fleet-live-map-plan.md), [maps-product-plan](./maps-product-plan.md) |
| Ops use of external route/clock tools | unknown (ops) | fleet | later | Outside this component | — |

## Active drivers / facts

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Active drivers list UI | yes | fleet | yes | `ActiveDriverService.php` | — |
| Edit driver code / trainer / clearquote / home-run | yes | onboarding | yes | Via `DriverDirectory` → DriversEngine (SF: fact map write-back) | — |
| Grant/revoke vehicle access | yes | fleet | yes | `ActivedriversController` grant/revoke | — |
| Does not query RSForm / Driver States tables | yes | fleet | yes | `DriverDirectory` header comment | — |

## Grants

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| `fleet.approve` | yes | fleet | yes | `access.xml` | — |
| `fleet.dispatch` | yes | fleet | yes | `access.xml` | — |
| `fleet.book.any` | yes | fleet | yes | `access.xml` | — |
| `fleet.operations` | yes | fleet | yes | `access.xml`; `FleetHelper::canOperate` | — |
| Which live groups hold which ACL | unknown (ops) | core | yes | Site ACL UI / DB | — |

## Tables (summary)

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| `#__primeone_fleet_depots` (+ contacts) | yes | fleet | yes | `sql/install.mysql.utf8.sql` | — |
| `#__primeone_fleet_vehicles` (+ managers, documents, access) | yes | fleet | yes | install SQL | — |
| `#__primeone_fleet_bookings` | yes | fleet | yes | install SQL | — |
| `#__primeone_fleet_own_vehicle*` | yes | fleet | yes | install SQL | — |
| `#__primeone_fleet_vehicle_logs` / `_vehicle_photos` | unknown (ops) | fleet | later | Schema only; unused in PHP | — |
| `#__primeone_fleet_leave` / `_holidays` | yes | fleet | yes | install SQL | — |
| `#__primeone_fleet_rentals` / `_rental_companies` | yes | fleet | yes | install SQL | — |
| `#__primeone_fleet_home_runs` | yes | fleet | yes | install SQL | — |
| `#__primeone_fleet_item_types` / `_item_requests` | yes | fleet | yes | install SQL | — |
| `#__primeone_fleet_damages*` / `_service_issues*` / `_work_reports*` | yes | fleet | yes | install SQL | — |

## Export / reconciliation

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| CSV grid export (date × vehicle) | yes | fleet | yes | `BookingsController::export`; `BookingsModel::buildCsv` | — |
| XLSX station roster (`sent` + accepted*) | yes | fleet | yes | `RosterWorkbook.php` | — |
| CSV roster fallback | yes | fleet | yes | `RosterWorkbook::csv` | — |
| Import / reconcile tooling in component | no | fleet | later | Export only; match week before import is ops process | [primeone-pack-plans](./primeone-pack-plans.md) |

## Emails (fleet)

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Outbound booking / approve mailer | no | email-manager | later | No Mailer in fleet services | — |
| Contact emails on depot / vehicle (mailto) | yes | fleet | yes | Depot/vehicle managers; `tmpl/_email_copy.php` | — |

## Row count

**75** inventory rows in this file (including related-extensions block).

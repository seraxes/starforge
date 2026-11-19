# product:subscriptions — pack plan

**Status:** Lifecycle MVP implemented (Membership Pro–inspired, Starforge ownership). Live queue: [architecture-current](./architecture-current.md) — after paid event tickets, before ads.

## Ownership

| Owns | Consumes |
| --- | --- |
| Plans, periods, seats, entitlement resolve, trial/renew/upgrade rules, group membership **sync** | **payments** (cart, coupons, invoices, recurring intents) |
| | **email-manager** (`emitEmailTrigger` + starters) |
| | **forms** (`subscription-registration` preset; plan editor selects the definition) |
| | **media** (plan thumbnail via MediaPicker; optional require) |
| | **profiles** (labels) |
| | **Core ACL** (groups + matrix; Subscriptions only add/remove members) |

## Access pattern (pages / modules / later NetSuite)

1. Create Core groups; grant them page/nav/admin access under Users/ACL.
2. On each plan, select those **access groups** (+ entitlement keys for domain features).
3. Subscribe → member added to groups; expire → removed if no other active period still grants the group.
4. Keep `hasEntitlement` for Events/Payments domain logic — do not replace with group-name checks.

Rules: [sf-subscriptions-module](../../../.cursor/rules/sf-subscriptions-module.mdc), [sf-payments-module](../../../.cursor/rules/sf-payments-module.mdc), [sf-email-module](../../../.cursor/rules/sf-email-module.mdc). Module README: [src/modules/subscriptions/README.md](../../../src/modules/subscriptions/README.md).

## Shipped

- Free + paid plans; day/week/month/year/lifetime with `billingIntervalCount` (N units per charge); fixed expiry; trial; capacity; grace; early-renew window (`earlyRenewDays`, 0 = renew only at period end); seats; cancel-at-period-end.
- Checkout modes subscribe / renew / upgrade via Payments; free activate without cart.
- Email triggers with `buyerEmail`; self-rescheduling expiry + reminder job.
- Forms preset + plan editor signup-form select (`formDefinitionId`) with a deep-link into Forms.
- Plan editor: Media thumbnail. Plan changes live on `/admin/subscriptions/changes` (`sf_sub_upgrade_paths`). A higher price starts immediately and the path chooses pay-the-difference or pay-full-price. A lower price waits for the next renewal. No refund.
- Same-plan repeat is refused until the period ends, unless that plan’s early-renew window is open. The buyer sees time left and the next renew date.
- Payments `sf_pay_recurring` create/cancel API for auto-renew opt-in.
- Admin Settings tab (`/admin/subscriptions/settings`) for reminder days, default grace, default Forms id, email seed, and deep-links to Payments / Email / Forms / Users. Changes tab lists from-plan → to-plan rows.
- Email Manager starters for activated / renewed / upgraded / expiring_soon / trial_ending / expired (`buyerEmail`).
- Plan access-group multi-select; Core membership sync on activate/expire.
- Public `/plans` catalog + `subscription-plans` particle (layout placement). Nav module links for Plans and My subscriptions.

## Parked

Membership cards, drip content, members directory, newsletter sync, content-locale plan titles (follow Localization when siblings land), gateway auto-charge adapters beyond the recurring table handle.

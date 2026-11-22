# product:subscriptions

Layer: advanced

Status: shipped

Plans, periods, and entitlements. Payments charges and snapshots; this pack grants access. Email Manager sends mail. Forms owns optional intake. Core ACL owns groups — this pack syncs membership for plan groups.

## Owns

- Plan catalog (`sf_sub_plans`). Type is `subject`; subtype is `audience`.
  - `membership` — players: `premium` (blank counts as this), `premium_plus`
  - `organizer` — organizers: `organizer` (blank counts as this), `brand` (owns a managed page that operates as their website)
  - `advertisement` — `organizer`, `marketplace`, `brand`, `shop`
  - `other` — catch-all, including unknown subject strings
- Billing length: `billingPeriod` (day / week / month / year / lifetime) × `billingIntervalCount`. Snapshotted on periods.
- Periods (`sf_sub_periods`) — active / expired / refunded windows with entitlement + group snapshots. Admin may change the end date or expire a period. Refunds stay with Payments.
- Seats (`sf_sub_seats`) — group membership pool on a parent period.
- Lifecycle rules: free activate, trial (once), manual renew, upgrade paths + proration credit, grace hours, cancel-at-period-end, capacity `maxActive`.
- Plan changes (`sf_sub_upgrade_paths`) — Admin **Changes** at `/admin/subscriptions/changes`. Higher price starts now (`prorate` or `full`). Lower price applies on next renewal, no refund.
- Same-plan repeat stays closed while time remains, unless `earlyRenewDays` opens a window.
- Resolve API: `hasEntitlement`, `resolveAudience`, `hasActiveSubject`.
- Core **group membership sync** for plan/period `groupIds` (add on activate, remove on expire when unused).
- Admin `/admin/subscriptions` (plans + subscribers + changes + settings + CSV export).
- Pack settings in `sf_module_settings` (reminder days, default Forms id, default grace).
- Email Manager triggers `product:subscriptions/*` + starter seed (activated, renewed, upgraded, expiring_soon, trial_ending, expired).
- Public catalog `/plans` + **`subscription-plans`** layout particle. Nav views: Plans (`/plans`), My subscriptions (`/account/subscriptions`).

**Access model (hybrid):** Pages/nav/modules use plan access groups → Core membership → ACL. Ticket price, `payments.collect`, `events.manage` use `hasEntitlement` / `resolveAudience`.

**Built-in entitlement keys:** `events.member`, `events.manage`, `payments.collect`, `social.challenge.multi`.

**Frozen Payments stub:** `sf_pay_collect_entitlements` stays a boolean stub. When this pack is enabled, `hasCollectCapability` reads `payments.collect`.

**Locked money / mail:** Free plans (`price = 0`) activate without a cart. Paid / charged trials always go through Payments. Coupons and invoices stay in Payments. Never call `getMailer()` from this pack.

## Consumes

- **`product:payments`** — `createCart` / `addCartLine` (`plan`) / `startCheckout` with hook `subscriptions.activate`. Coupons forwarded only. Recurring intents via `createRecurring` / `cancelRecurring`. No second cart.
- **`product:email-manager`** — `emitEmailTrigger` only (payload includes `buyerEmail`). Starters under Email Manager.
- **`product:forms`** — optional plan `formDefinitionId`; preset `subscription-registration`. `ensureSubscriptionRegistrationFormSeeded` stays here (settings, admin actions, `bootSubscriptions`). Forms admin does not seed it.
- **`product:profiles`** — subscriber labels via `getPersonas`. Store `userId` only.
- **`form`** (`optionalRequires`) — Form particle for brochure placement when used
- **`product:media`** (`optionalRequires`) — plan thumbnail via `MediaPicker` (`imageMediaId`); editor keeps stored id when Media is off
- **Content locales** — plan title/description via `LocaleInput` → `data/content-locales/{locale}/subscriptions/{planId}.json` (planned parity with Events categories)
- **Core ACL** — `addUserToGroup` / `removeUserFromGroup` / `listUserGroupOptions`. Does **not** write ACL permission rows

## Public door

`@/modules/subscriptions/api` (server-only door; **no** separate `api.server.ts`). Exports include `hasEntitlement`, `resolveAudience`, `hasActiveSubject`, `startSubscriptionCheckout`, `ENTITLEMENT_KEYS`, plan/period/seat CRUD, checkout price resolve, expiry sweep helpers, email seed helpers, `ensureSubscriptionsPaymentHook`, `ensureSubscriptionsExpiryJob`, settings load/save, CSV export helpers, and related constants (`CHECKOUT_MODES`, `PLAN_BILLING_PERIODS`, `SUBSCRIPTIONS_EXPIRY_JOB`, …). Door id: `subscriptions-api`.

```ts
import {
  hasEntitlement,
  resolveAudience,
  startSubscriptionCheckout,
  ENTITLEMENT_KEYS,
} from '@/modules/subscriptions/api'
```

## Admin surfaces

- `/admin/subscriptions`, `/admin/subscriptions/subscribers`, `/admin/subscriptions/changes`, `/admin/subscriptions/settings`
- ACL area: `subscriptions`
- Public: `/plans`, `/account/subscriptions`

## Boot and jobs

`bootSubscriptions` when on: form seed, Payments collect resolver registration, expiry job — **skipped when module off**. Job: subscriptions expiry sweep (`SUBSCRIPTIONS_EXPIRY_JOB` / `ensureSubscriptionsExpiryJob`). Payment hook `subscriptions.activate` registered from boot.

## Known gaps

- Phase 5 parked: membership cards/QR, drip content, downloads, members directory, newsletter list sync, affiliate, forced registration redirect
- Plan title/description still on row columns; LocaleInput + content-locale files pending full wire-up
- Out of scope: ASN currency, ad inventory, listing ranking, writing ACL permission rows from purchase, gateway secrets, invoice PDF generation

## Tests

`src/modules/subscriptions/catalog.test.ts`

# product:subscriptions

Plans, periods, and entitlements. Payments charges and snapshots; this pack grants access. Email Manager sends mail. Forms owns optional intake. Core ACL owns groups — this pack syncs membership for plan groups.

## Owns

- Plan catalog (`sf_sub_plans`). Type is `subject`; subtype is `audience`.
  - `membership` — players: `premium` (blank counts as this), `premium_plus`
  - `organizer` — organizers: `organizer` (blank counts as this), `brand` (owns a managed page that operates as their website)
  - `advertisement` — `organizer`, `marketplace`, `brand`, `shop`
  - `other` — catch-all, including unknown subject strings
- Periods (`sf_sub_periods`) — active / expired / refunded windows with entitlement + group snapshots. Admin may change the end date or expire a period. Refunds stay with Payments.
- Seats (`sf_sub_seats`) — group membership pool on a parent period.
- Lifecycle rules: free activate, trial (once), manual renew, upgrade graph + proration credit, grace hours, cancel-at-period-end, capacity `maxActive`.
- Resolve API: `hasEntitlement`, `resolveAudience`, `hasActiveSubject`.
- Core **group membership sync** for plan/period `groupIds` (add on activate, remove on expire when unused).
- Admin `/admin/subscriptions` (plans + subscribers + settings + CSV export).
- Pack settings in `sf_module_settings` (reminder days, default Forms id, default grace).
- Email Manager triggers `product:subscriptions/*` + starter seed (activated, renewed, upgraded, expiring_soon, trial_ending, expired).

## Consumes

- **`product:payments`** — `createCart` / `addCartLine` (`plan`) / `startCheckout` with hook `subscriptions.activate`. Coupons forwarded only. Recurring intents via `createRecurring` / `cancelRecurring`. No second cart.
- **`product:email-manager`** — `emitEmailTrigger` only (payload includes `buyerEmail`). Starters create templates/rules under Email Manager.
- **`product:forms`** — optional plan `formDefinitionId`; preset `subscription-registration` under Subscriptions category. Account subscribe renders the FormWidget intake; admin deep-links to `/admin/forms/[id]`.
- **Content locales** — plan title/description via `LocaleInput` → `data/content-locales/{locale}/subscriptions/{planId}.json` (same pattern as Events categories).
- **`product:profiles`** — subscriber labels via `getPersonas`. Store `userId` only.
- **`product:media`** — plan `imageMediaId` via MediaPicker when wired in admin.
- **Core ACL** — `addUserToGroup` / `removeUserFromGroup` / `listUserGroupOptions`. Does **not** write ACL permission rows or own the matrix UI.

## Access model (hybrid)

| Surface | Mechanism |
| --- | --- |
| Pages, nav, modules, later NetSuite | Plan **access groups** → Core membership → existing ACL |
| Ticket price, `payments.collect`, `events.manage` | **`hasEntitlement` / `resolveAudience`** |

## Built-in entitlement keys

| Key | Subject | Effect |
| --- | --- | --- |
| `events.member` | membership | Member ticket price (Events) |
| `events.manage` | organizer | Satisfies `admin.events` at request time |
| `payments.collect` | organizer | Merchant collect when Subscriptions is on |

## Consumer contract

```ts
import {
  hasEntitlement,
  resolveAudience,
  startSubscriptionCheckout,
  ENTITLEMENT_KEYS,
} from '@/modules/subscriptions/api'

await hasEntitlement(userId, ENTITLEMENT_KEYS.eventsMember)
await resolveAudience(userId) // { entitlementKeys, groupIds, periodIds }
```

## Frozen Payments stub

`sf_pay_collect_entitlements` stays a boolean stub. When this pack is enabled, `hasCollectCapability` reads `payments.collect`. When off, the stub / ACL auto-grant stays.

## Locked money / mail rules

- Free plans (`price = 0`) activate without a cart.
- Paid / charged trials always go through Payments.
- Coupons and invoices stay in Payments (deep-link admin).
- Never call `getMailer()` from this pack.

## Content-locale note

Plan title/description remain on `sf_sub_plans` columns for this pass. Wire `LocaleInput` + content-locale files when Localization owns sibling entity catalogs the same way (see Events categories). Do not invent a second resolve helper.

## Parked (Phase 5)

Membership cards/QR, drip content, downloads, members directory, newsletter list sync, affiliate, forced registration redirect.

## Out of scope

ASN currency, ad inventory, listing ranking, event-series CRUD, writing ACL **permission** rows from a purchase, gateway secrets, invoice PDF generation.

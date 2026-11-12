# product:subscriptions

Plans, periods, and entitlements. Payments charges and snapshots; this pack grants access.

## Owns

- Plan catalog (`sf_sub_plans`) — subjects: `membership` (player premium), `organizer` (event management), `advertisement` (shop / organizer promo / marketplace boost). Subject is an open string for later kinds.
- Periods (`sf_sub_periods`) — active / expired / refunded windows with entitlement + group snapshots.
- Resolve API: `hasEntitlement`, `resolveAudience`, `hasActiveSubject`.
- Admin `/admin/subscriptions` (plans + subscribers).
- Email Manager triggers `product:subscriptions/activated` and `product:subscriptions/expired`.

## Consumes

- **`product:payments`** — `createCart` / `addCartLine` (`plan`) / `startCheckout` with hook `subscriptions.activate`. Coupons forwarded only. No second cart.
- **`product:email-manager`** — `emitEmailTrigger` only.
- Core `sf_user_groups` ids on plans for audience resolve — **does not** write `sf_user_group_members` or ACL rows.

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

## Out of scope

ASN currency, ad inventory, listing ranking, event-series CRUD, gateway auto-renew, writing ACL/group membership from a purchase.

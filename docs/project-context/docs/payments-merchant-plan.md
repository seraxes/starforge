# Premium merchant collect (own keys + own invoices)

**Status:** Implementation wave after site MoR cart.  
**Fees:** No platform % take-rate for now — flat subscription unlocks collect.  
**UI:** Clone Events/Layouts shell only ([sf-ui-design](../../../.cursor/rules/sf-ui-design.mdc)).

## Model

| Mode | Who gets paid | Keys | Invoice |
| --- | --- | --- | --- |
| Site MoR | Site (`sf_pay_settings`) | Env catalog | Site series + optional NAV |
| Merchant | Organizer/vendor | Encrypted `sf_pay_merchant_credentials` | Billingo / Számlázz.hu via `BillingProvider` |

## Entitlement

`canCollectPayments` (frozen `sf_pay_collect_entitlements` stub, later replaced by `product:subscriptions`) **and** ACL `admin.payments-merchant`. Do not grow the stub into plans or periods. Merchant keys stay in the encrypted credentials table — that is the secrets exception, not a reason to put site-wide secrets in the database.

## Bridges

- Gateways: Barion (first), Stripe, PayPal — factory accepts merchant credentials  
- Billing: Billingo, Számlázz.hu — never fork their UIs inside SF  
- Email: `product:payments/*` via Email Manager only  

## Related

- [payments-cart-plan](./payments-cart-plan.md)
- `@/modules/payments/api` — `assertMayCollect`, merchant CRUD, `startCheckout({ merchantId })`

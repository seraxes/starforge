# Modular core reuse

## When
Building any Core CMS feature that collects or structures user input, content blocks, or admin UI.

## Rule
Ship capabilities as toggleable modules. Prefer one shared engine (e.g. Form) reused by contact, survey, events, voting, tickets/reports — typed presets and workflow layers on top, not parallel builders. Same for media: one Payload media library; social stream, event gallery, paid organizer pages only filter/tag/ACL the same assets — no parallel media stores. Same for money: one **`product:payments`** cart/orders/VAT/gateway engine; subscriptions, event tickets, ads (and later shop/marketplace) consume it — they own catalog, domain price rules, and fulfillment, not a second checkout. New work plugs in; Site Settings can turn it off without ripping the platform.

**Ownership is continuous:** when “which module owns X?” is decided, write it into the owner README, `.cursor/rules/sf-*-module.mdc`, and `docs/project-context` — do not leave it only in chat ([sf-module-ownership](../../../.cursor/rules/sf-module-ownership.mdc)).

## Stops when
A true one-off integration cannot share schema/UX without fighting the engine — then document the exception; do not invent a second general form stack.

## Added
2026-11-01  
**Updated** 2026-11-08 — payments revenue spine + continuous ownership docs.

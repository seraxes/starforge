# product:marketplace

Layer: advanced

Status: parked

## Owns

Thin dashboard stub only so `/admin` can show a **Marketplace** soft card via `admin.dashboard[]` (`marketplace.listings`). No schema, no admin routes, no public UI yet. Full listings / fees / boosts pack is parked behind finishing Social then Ads (live map). Toggle under Site Settings → Modules (`defaultEnabled: true` for the stub card).

## Consumes

None (`requires` / `optionalRequires` empty). When built, money movement will use `product:payments` (same cart/orders); do not invent a second cart.

## Public door

none

## Admin surfaces

Dashboard card only. ACL area: `marketplace`. No `/admin/marketplace` routes.

## Boot and jobs

None.

## Known gaps

- No `sf_marketplace_*` schema, routes, or admin UI.
- Destination rating / listings tables TBD when the pack ships (see ops migration notes).
- Full pack per ASN modules wireframe — not ahead of Social → Ads on the live map.

## Tests

None registered in `test:unit` for this pack.

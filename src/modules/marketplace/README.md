# product:marketplace

Layer: advanced

Class: advanced — domain product. Stub `requires` is empty until the commerce schema; it will `require` Payments. Next after Social polish ([2026-11-26-base-vs-advanced](../../../docs/project-context/docs/decisions/2026-11-26-base-vs-advanced.md)).

Status: next after Social (stub today). Proposed design: [marketplace-pack-plan](../../../docs/project-context/docs/marketplace-pack-plan.md). Coding slices: [marketplace-build-spec](../../../docs/project-context/docs/marketplace-build-spec.md). Do not scaffold while Social polish is the active lane.

## Owns

Thin dashboard stub only so `/admin` can show a **Marketplace** soft card via `admin.dashboard[]` (`marketplace.listings`). No schema, no admin routes, no public UI yet. Full listings / fees / boosts pack builds after Social polish. Ads stays parked until after Marketplace (live map). Toggle under Site Settings → Modules (`defaultEnabled: true` for the stub card).

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
- Full pack per [marketplace-pack-plan](../../../docs/project-context/docs/marketplace-pack-plan.md) and [marketplace-build-spec](../../../docs/project-context/docs/marketplace-build-spec.md) — not ahead of Social. Ads follows Marketplace.

## Tests

None registered in `test:unit` for this pack.

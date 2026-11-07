# Maps / location sharing (Modules)

**Layer:** **Modules** (`product:maps`) for shares/privacy/particle/API. **`MapProvider`** = **Core port**. ASN field-finder filters / branded chrome = **Hero** — not a maps fork ([platform-module-layers](./platform-module-layers.md)).

**Goal:** Platform **map + geolocation sharing** as an optional **Module** — data model, privacy scopes, map particle; map provider port hosted in Core. Mobile Starforge app uses the same APIs later.

**Status:** **Venue pins + MapProvider + map particle shipped** (`product:maps`). Generic user location **shares** (everyone/friends/selected) remain plan-only.

**Live tactical rooms** (closed event roster / same-team GPS) are a **separate product surface** — see [maps-live-tactical](./maps-live-tactical.md). Do not conflate tactical sessions with social share scopes.

## Scope (Module)

| Piece | Owns |
| --- | --- |
| **Location share** | User- (or org-) owned point/region: lat/lng (or coarse cell), label, accuracy, expiry, privacy scope |
| **Privacy scopes** | `everyone` \| `friends` \| `selected` (explicit user/group ids) — friends = Social graph when that Module exists; until then `selected` + groups cover “chosen people” |
| **Map particle / embed** | Public or ACL-filtered map view bound to shares / venue pins |
| **Map provider port** | Tile/geocode/static-map adapter in **Core** (swap Mapbox / Google / OSM+Leaflet without rewriting consumers) |
| **Venue binder** | Events Module optional `locationId` or embedded geo ([events-manager-plan](./events-manager-plan.md)) |
| **API** | Authenticated create/update/revoke + read filtered by caller ACL — same model for web and future mobile |

## Out of scope (now / Hero)

- Shipping a native mobile app (consume Module APIs later)
- Live GPS tracking / history trails (later opt-in product mode)
- ASN “field finder” as a separate backend → **Hero** filters on Maps/Events entities only

## Privacy scopes + ACL

Align with existing **groups-only** ACL ([preferences](../preferences.md)):

| Scope | Who can read |
| --- | --- |
| **everyone** | Public (still respect site offline / auth gates on the page) |
| **friends** | Social friend/follow edge when Social Module enabled; if Social off, treat as unavailable or map to a dedicated group |
| **selected** | Explicit user ids and/or **group** tags (OR match) |

- Owner always reads/edits/revokes own shares.
- Admin/moderation via groups matrix (Users ACL) — not a second Access Level entity.
- Empty selected list = deny others (fail closed).

## Map provider port (Core adapter)

```ts
export type GeoPoint = { lat: number; lng: number }

export type MapProvider = {
  id: string
  /** Geocode address → point (optional). */
  geocode?(query: string): Promise<GeoPoint | null>
  /** Reverse geocode for display labels (optional). */
  reverseGeocode?(point: GeoPoint): Promise<string | null>
  /** Embed / static / JS loader hints for the particle (provider-specific URL or token-scoped config). */
  clientConfig(): { provider: string; publicKeyEnv: string; defaultStyle?: string }
}
```

| Adapter (later) | Role |
| --- | --- |
| `leaflet-osm` | Easiest local/dev; no paid key for basic tiles |
| `mapbox` / `google` | Prod tiles + geocode when keys present |

Secrets (`MAPBOX_TOKEN`, `GOOGLE_MAPS_API_KEY`, …) in env / Environment editor only. Site Settings: enable Maps Module + provider enum + default share precision.

## Security / privacy notes

| Topic | Rule |
| --- | --- |
| **Consent** | Sharing location is **explicit opt-in** (user action). No background publish from web without a clear control. Mobile later: OS permission + in-app consent copy. |
| **Precision** | Store/display **configurable precision** (exact vs ~100m / city-level fuzz). Default to coarser for `everyone`; allow exact only when scope is tight (`friends` / `selected`) or user explicitly chooses exact. |
| **Revoke** | Soft-delete or `revokedAt`; reads must stop immediately; client caches must revalidate. Expiry timestamp auto-revokes. |
| **Minimize** | Do not log raw high-precision coords in app logs; audit “who shared” without dumping coordinates. |
| **ACL enforcement** | Filter on **server** read APIs — never trust client “scope” alone. |
| **Embeds** | Public map particles only show shares the anonymous/authenticated viewer may see; venue public pins are Events ACL, not leaked private shares. |
| **Sensitive sites** | No special casing beyond ACL + consent; ops may disable Maps via Module Manager. |

## Mobile (later)

- Maps Module + Core ports own schema, privacy, and routes; mobile Starforge app is a client.
- Push/background location = separate explicit product mode with harder consent — not implied by this plan.
- Reuse Better Auth session (or mobile-friendly token) — no second identity stack.

## Module shape

- Allowlist id e.g. `product:maps` (+ particle `map`).
- Depends on: Core Auth/Users/Groups + MapProvider port; optional Social (friends scope); optional Events (venue pins); Media unused unless pin icons.
- Toggle off → particles no-op; APIs 404/disabled.
- Hero: branded map chrome / vertical filters only — do not fork Maps.

## Success

Sites can let users share a point with everyone, friends, or selected people; Events can pin venues; map tiles come from a swappable Core provider port; privacy (consent, precision, revoke) is enforced before any mobile client exists — without Hero forking the Module.

## Related

- [platform-module-layers](./platform-module-layers.md)
- [core-modules-inventory](./core-modules-inventory.md)
- [events-manager-plan](./events-manager-plan.md)
- [media-pipeline-plan](./media-pipeline-plan.md)

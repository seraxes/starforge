# product:profiles

Member **persona / identity** layer. One `sf_profiles` row per account. Every other pack stores `userId` and resolves identity through `@/modules/profiles/api.server` — never copies names or avatars.

## Contract for other modules

```ts
import { getPersonas, getPersona, personaMediaSrc } from '@/modules/profiles/api.server'

const personas = await getPersonas(userIds, viewer)
const seller = personas.get(listing.userId)
// seller.displayName / avatarMediaId / href are already privacy-projected
```

| Helper | Use |
| --- | --- |
| `getPersonas(ids, viewer)` | Batch resolve (Events registrants, Marketplace cards, feed authors) |
| `getPersona(id, viewer)` | Single |
| `getPersonaByHandle(handle, viewer)` | Public `/u/[handle]` page |
| `getAgeYearsForEligibility(userId)` | Server-only age gates (never send to client) |
| `personaMediaSrc(mediaId)` | `/api/media/<id>` helper |

Works when Profiles is **off** or a user has no row yet: returns a minimal fallback Persona (account name, no handle).

## Surfaces

| Surface | Path |
| --- | --- |
| Member editor | `/[locale]/account/profile` |
| Public page | `/[locale]/u/[handle]` |
| Admin accounts (directory + account + profile pane) | `/admin/users`, `/admin/users/[userId]` |
| Settings | `/admin/profiles/settings` |
| Legacy redirects | `/admin/profiles`, `/admin/profiles/[userId]` → Users |

Toggle: **Settings → Modules → Profiles**. Depends on `product:media` (member upload ledger).

## Field model

Registry in `fields.ts` is the typed contract for privacy, Persona projection, and special widgets (avatar/cover crop, map pin, links). **Labels, order, required, section width % (same 5–100 model as Layout particles), and which inputs appear** are owned by the protected Forms definition `profile` (`/admin/forms/profile`) — same pattern as Events → `event-registration`. Removing a field from that form hides it on the editor; stored values are kept.

Locked (always on/public): display name, handle, avatar — forced on even if stripped from the Forms canvas. Site-wide **default visibility** stays under Profiles Settings. Hero packs add vertical data in `extensions` jsonb (`{ "hero:asn": { teamName } }`) — do not fork the registry.

Privacy scopes: `public` · `registered` · `friends` (off until Social) · `private`. Non-owners see rounded map coords (~1 km). Age is shown instead of birth date.

## Media

Members upload via `MemberMediaPicker` → shared Media pipeline + `sf_media_owners` ledger. Admins editing a profile use the full `MediaPicker` library. Members can only attach images they uploaded.

**Crop / position:** avatar (circle) and cover (wide) use the shared `ImageFrameEditor` (pan + zoom). Stored as `{ x, y, zoom }` on `avatar_frame` / `cover_frame` — same Media id; display via `FramedImage` / Persona `avatarFrame` · `coverFrame`.

## Migrations

- `0014_profiles_member_media` — `sf_profiles` + `sf_media_owners`
- `0015_profile_image_frames` — `avatar_frame` / `cover_frame`

Run: `npm run db:migrate`

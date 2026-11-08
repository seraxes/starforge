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
| Admin directory | `/admin/profiles` |
| Admin edit | `/admin/profiles/[userId]` |
| Settings | `/admin/profiles/settings` |

Toggle: **Settings → Modules → Profiles**. Depends on `product:media` (member upload ledger).

## Field model

Registry in `fields.ts` drives editor + settings + privacy. Locked (always on/public): display name, handle, avatar. Optional fields can be disabled / required / given site-wide default visibility under Settings. Hero packs add vertical data in `extensions` jsonb (`{ "hero:asn": { teamName } }`) — do not fork the registry.

Privacy scopes: `public` · `registered` · `friends` (off until Social) · `private`. Non-owners see rounded map coords (~1 km). Age is shown instead of birth date.

## Media

Members upload via `MemberMediaPicker` → shared Media pipeline + `sf_media_owners` ledger. Admins editing a profile use the full `MediaPicker` library. Members can only attach images they uploaded.

**Crop / position:** avatar (circle) and cover (wide) use the shared `ImageFrameEditor` (pan + zoom). Stored as `{ x, y, zoom }` on `avatar_frame` / `cover_frame` — same Media id; display via `FramedImage` / Persona `avatarFrame` · `coverFrame`.

## Migrations

- `0014_profiles_member_media` — `sf_profiles` + `sf_media_owners`
- `0015_profile_image_frames` — `avatar_frame` / `cover_frame`

Run: `npm run db:migrate`

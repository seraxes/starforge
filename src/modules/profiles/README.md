# product:profiles

Layer: base (manifest boot tag — not retagged)

Class: advanced — `requires` Media and Forms ([2026-11-26-base-vs-advanced](../../../docs/project-context/docs/decisions/2026-11-26-base-vs-advanced.md))

Status: shipped

Member **persona / identity** layer. Every other pack stores `userId` and resolves identity through `@/modules/profiles/api.server` — never copies names or avatars.

## Owns

One `sf_profiles` row per account. Field registry (`fields.ts`) for privacy, Persona projection, and special widgets; site-wide **default visibility** (Profiles Settings); locked display name, handle, avatar; `avatar_frame` / `cover_frame`; `ensureProfileFormSeeded` / `bootProfiles`; member editor, public `/u/[handle]`, and admin profile surfaces.

**Field model:** Registry in `fields.ts` is the typed contract. Labels, order, required, section width %, and which inputs appear are owned by the protected Forms definition `profile` (`/admin/forms/profile`) — same pattern as Events → `event-registration`. Removing a field from that form hides it on the editor; stored values are kept. `ensureProfileFormSeeded` stays in Profiles (settings load/save + `bootProfiles`). Forms admin does not seed it. Boot skips the seed when Profiles is toggled off.

Locked (always on/public): display name, handle, avatar — forced on even if stripped from the Forms canvas. The active hero’s `profileFields` are copied into `ACTIVE_HERO` (`@/generated/module-registry`). The editor renders that list into `extensions[heroId]` with `settings-field`. An empty list adds no section and a save does not rewrite `extensions`. Those keys are not part of `ProfileFieldKey`. Profiles does not import `@/hero`.

Privacy scopes: `public` · `registered` · `friends` (off until Social) · `private`. Non-owners see rounded map coords (~1 km). Age is shown instead of birth date.

**Media:** Members upload via `MemberMediaPicker` → shared Media pipeline + `sf_media_owners`. Admins editing a profile use the full `MediaPicker`. Avatar (circle) and cover (wide) use `ImageFrameEditor` (pan + zoom); stored as `{ x, y, zoom }` on `avatar_frame` / `cover_frame`; display via `FramedImage` / Persona frames.

Migrations: `0014_profiles_member_media`, `0015_profile_image_frames`.

## Consumes

- **`product:media`** — MemberMediaPicker / MediaPicker, ImageFrameEditor / FramedImage, member upload ledger
- **`product:forms`** — protected definition `profile`
- **`product:maps`** (`optionalRequires`) — map pin field when Maps is on

## Public door

- `@/modules/profiles/api` — `AccountNav`, `ProfileEditor`, `saveProfileAdminAction`, `setProfileStatusAction` (also re-exports `Persona` type)
- `@/modules/profiles/api.server` — `getPersonas`, `getPersona`, `getPersonaByHandle`, `getAgeYearsForEligibility`, `getOwnProfileContact`, `personaMediaSrc`, `PublicProfile`, `exportOwnProfileRecord`, `ensureProfileFormSeeded`, `buildEditorModel`, `isProfilesModuleEnabled`, `relationFor`, visibility helpers, admin actions

Works when Profiles is **off** or a user has no row yet: returns a minimal fallback Persona (account name, no handle).

```ts
import { getPersonas, getPersona, personaMediaSrc } from '@/modules/profiles/api.server'
```

| Helper | Use |
| --- | --- |
| `getPersonas(ids, viewer)` | Batch resolve (Events registrants, Marketplace cards, feed authors) |
| `getPersona(id, viewer)` | Single |
| `getPersonaByHandle(handle, viewer)` | Public `/u/[handle]` |
| `getAgeYearsForEligibility(userId)` | Server-only age gates |
| `personaMediaSrc(mediaId)` | `/api/media/<id>` helper |

## Admin surfaces

| Surface | Path |
| --- | --- |
| Member editor | `/[locale]/account/profile` |
| Public page | `/[locale]/u/[handle]` |
| Admin accounts | `/admin/users`, `/admin/users/[userId]` |
| Settings | `/admin/profiles/settings` |
| Legacy redirects | `/admin/profiles`, `/admin/profiles/[userId]` → Users |

- ACL area: `profiles`
- Routes: `profiles`, `settings`, `[userId]`
- Toggle: Settings → Modules → Profiles

## Boot and jobs

`bootProfiles` → `ensureProfileFormSeeded` when Profiles is on; skipped when off. No JobRunner jobs.

## Known gaps

- `friends` privacy scope off until Social is enabled for the site
- Hero `profileFields` via `ACTIVE_HERO` / `extensions` — Profiles does not import `@/hero`

## Tests

`src/modules/profiles/fields.test.ts`, `src/modules/profiles/hero-profile-fields.test.tsx`, `src/modules/profiles/messages-parity.test.ts`

Member chrome: `messages/en.json` + `messages/hu.json` (`product:profiles`). Editor-typed field labels stay on Forms / LocaleInput.

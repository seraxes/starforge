---
kind: decision
last_verified: 2026-11-22
---
# Decision: Social hard requires for Payments and Maps

**Date:** 2026-11-22

**Decision:** Remove `product:payments` and `product:maps` from Social’s hard `requires`. Payments is not a Social dependency. The current `product:maps` module is the tactical event map (TacMap, ARES Alpha style) for events — not a Social requirement. Do not rename the module id in this change. Social must boot with both packs off. Do not add a Social cart. If Social later imports either pack, put the call behind an enabled check and list that pack in `optionalRequires` only. Open work: rename `product:maps` to TacMap in a later slice.

**Status:** accepted

**Supersedes:** Prior Social standing that required Payments so Social would never grow a cart, and hard Maps for check-in.

**Constraint (one sentence an agent can follow):** Keep Social’s hard `requires` free of `product:payments` and `product:maps`; never add a Social cart; do not rename `product:maps` until a dedicated rename slice.

**Consequences:**

- Enabling Social no longer auto-enables Payments or Maps.
- Check-in already uses Core `getMapProvider()` (not `@/modules/maps`); no Maps public-door import → Maps stays off Social’s `optionalRequires` until a real pack call exists.
- No Payments import in Social today → Payments stays off both lists; charge paths later must use Payments, not a Social cart.
- TacMap rename is documented Open work only.

**Verification:** `src/modules/social/manifest.ts` matches the accepted edge lists; `npm run check:atomic`; Social boots with Maps and Payments off.

**Confirmed manifest after acceptance** (`src/modules/social/manifest.ts`):

```text
requires: [
  'product:profiles',
  'product:media',
  'product:rich-editor',
  'product:forms',
  'product:email-manager',
]
optionalRequires: ['form', 'product:subscriptions', 'product:events']
defaultEnabled: false
```

**Choice (recorded):** **D4 — Both optional** (and neither listed while Social does not call their public doors). Lightest Social enable floor; Profiles / Media / Rich editor / Forms / Email Manager remain hard.

**Out of scope here:** whether particle id `form` stays in `optionalRequires` (separate Open work); renaming `product:maps` (Open work); whether Social is enabled at launch ([2026-11-22-launch-scope](./2026-11-22-launch-scope.md)).

**Files to update:**

- Rule: none required for this edge change
- Live map: Social `requires` line; Open work rename TacMap
- Owner README: `src/modules/social/README.md` (Consumes / requires)

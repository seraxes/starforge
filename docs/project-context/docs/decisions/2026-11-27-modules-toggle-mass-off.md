---
kind: decision
last_verified: 2026-11-27
---
# Decision: Modules toggles cannot be wiped by one save

**Date:** 2026-11-27

**Decision:** Settings → Modules reads the live site-settings row (the same row the admin sidebar uses). One Modules save may turn off at most one catalog id. A submit that would turn off more than one currently enabled module is refused and does not write.

**Status:** accepted

**Supersedes:** —

**Constraint (one sentence an agent can follow):** Do not paint Settings → Modules from the published site-settings cache, and do not persist a Modules save that disables more than one catalog id.

**Consequences:**

- The admin sidebar uses `ensureSiteSettingsDefaults()` (live row). The Modules form uses `getSiteSettingsLive()`. A stale cache must not be the checkbox source, because that form autosaves every switch and would write the stale “all off” paint back.
- Empty `moduleToggleId` lists still keep the stored map. A full list that flips many ids from on to off is a separate refuse (`moduleToggleOffIds`).
- Turning one module off stays allowed. Requires-graph errors still apply after that check.
- Packs with `defaultEnabled: false` (Ads, Onboarding, Audit, PWA, Lexical) stay off until someone turns that one switch on. Social may be on for this local site even though its manifest default is off.

**Verification:** `src/app/(frontend)/admin/settings/settings-modules-state.test.ts` (one off allowed; many offs listed). Counter: `moduleToggleOffIds` in `src/core/settings/module-catalog.ts`. Settings page: `src/app/(frontend)/admin/settings/page.tsx`. Guard: `updateSiteSettingsAction` in `src/core/settings/actions.ts`.

**Files to update:**

- Rule: none (this is a settings invariant, not a layer)
- Live map: `docs/project-context/docs/architecture-current.md`
- Owner README: none (Core settings)

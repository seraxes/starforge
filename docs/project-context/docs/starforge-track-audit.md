# Starforge track audit (for Zoltan)

**Scope:** `origin/main` @ `506f42c`  
**Lens:** preferences + [modular-core](/cursor/stores/self/principles/modular-core.md)  
**Date:** 2026-11-02

## Verdict

**On the right track.** The Core-vs-Payload split, Gantry-like layout, modular Form engine, Site Settings toggles, one Better Auth login, and ASN-later discipline match the locked architecture. Integrity is mostly sound after recent autosave/remount work; the remaining must-fix is Page Settings (and Layout outline) remount identity so autosave cannot write the wrong target. Biggest product gaps vs vision are media pipeline depth and install-time module allowlist — not a wrong stack.

## Strengths

- **Stack coherence:** Next App Router + Better Auth/Drizzle (`sf_*`) + Payload 3 (schema `payload`) + Postgres. Product auth is single-login; Payload users are CMS stubs via `cms-bridge` / `/api/cms/exchange` — not a second password.
- **Ownership split is intentional:** Core owns users, groups/ACL, Site Chrome, Nav, Layouts/Outlines/Page Settings, Forms; Payload owns pages body + Lexical + Media. Two-way admin links without merging the products.
- **Gantry-like layout in Core:** sections/rows/particles, outlines, canvas styles + breakpoints, Page Settings chrome, typed particles (Logo/Menu/Copyright/Social/Custom/page-content) — matches prefs, not Payload-only layout.
- **Form engine direction:** one Core Form (`dnd-kit` + JSON/Zod evaluate path, conditional + math, Layout-like builder chrome). Contact preset shipped; survey/event/voting/ticket are stubs by design. No SurveyJS.
- **Modular toggles:** Site Settings module on/off gates admin nav and public slot render. Catalog is small (`form`, `notice-bar` + builtin particles).
- **Public content path:** Payload published pages via cached `getPublishedPageBySlug` → layout `page-content` particle (no hard-coded `.home` scaffold).
- **Recent integrity wins:** SF-91 nav autosave loop, SF-78 captcha `server-only` split, SF-72 particle cog draft stability — patterns to keep.

## Risks

| Severity | Issue | Notes |
| --- | --- | --- |
| **Critical** | Page Settings form has **no remount `key`** when switching Edit target | Local draft + updated hidden `pageKey` → autosave can persist old chrome onto the new page. Same class already keyed on Nav/Forms. |
| **High** | Layout editor outline switch lacks `key={layoutId}` + soft-merge keeps prior topology/drafts | Sibling of the Page Settings bug; can write stale canvas/cog state to the newly selected outline. |
| **Medium** | “No deadweight” only half-met | Runtime toggles gate UI; `ensureModulesRegistered()` still eagerly imports Form/Notice. Missing `starforge.modules.json` / build allowlist. |
| **Medium** | Dual *paths* inside one Form/Media story | Legacy Form particle `fieldsJson` + definition IDs; Logo/Styles still accept raw URLs until SF-28/66. Not second stacks — still integrity surface. |
| **Medium** | Prod hardening deferred (OK for local-first) | Cookie `secure: false`, empty Payload `csrf`, Redis cache stub throws if selected. Fine until DO; do not forget. |
| **Low** | Docs drift | `starforge-build-plan.md` still reads scaffold-era while Core already shipped layout/forms/chrome. |
| **Low** | Residual SF-91-class effects | Social particle / Page Settings “state → effect → saveDebounced” are safe today but fragile if server re-seed returns. |

No dual Form product stack and no second media store found. Client trees currently import Form/ACL leaves, not `server-only` barrels — keep that discipline.

## Concept validity

| Vision item | State |
| --- | --- |
| Gantry layout in Core | Done |
| Outlines / Page Settings / styles+breakpoints | Done (bg-image interim URL) |
| Modular Form engine + Layout-like UX | Done (presets beyond contact = stubs) |
| Site Settings module toggles | Done (runtime) |
| Install/build allowlist | Missing |
| One login → Payload | Done |
| Groups ACL (not Access Levels) | Done (+ naming debt `accessTags`) |
| One Payload media library + pipeline | Partial (collection only; SF-28 open) |
| Public body from Payload via layout | Done |
| ASN later (~70% platform) | Discipline holding — almost no ASN code |

**Not drifting.** Main temptation to watch: chrome polish consuming cycles that belong to media + allowlist before ASN pressure invents parallel form/media shortcuts.

## Recommended next priorities

1. **Fix remount identity** — Page Settings `key={editingPageKey ?? 'global'}`; Layout (and sibling style panels) `key={layoutId}` — stop cross-target autosave bleed.
2. **SF-28 / SF-66** — Payload media pipeline (folders, resize/WebP) + bind Styles/Logo/Form option media to the library (retire raw URL as primary).
3. **Refresh SF-14 build plan** — rewrite against shipped Core so the roadmap matches reality.
4. **Module allowlist P1** — `starforge.modules.json` (+ optional package sync) before more optional modules; toggles alone will not meet “no deadweight.”
5. **Hold ASN (SF-8)** until media + allowlist are real; keep Form presets as seeds, not parallel builders.
6. **When approaching DO:** cookie `secure`, Payload CSRF, Redis cache implementation behind existing interface.

## PR from this pass

Critical remount keys only: [#48](https://github.com/seraxes/starforge/pull/48) on `cursor/admin-remount-keys-caff` (Page Settings + Layout + Styles/Breakpoints). No broad refactor.

---

*Working notes (evidence dumps):*  
`/cursor/stores/bc-824f7a6e-924f-4836-adf3-fd011debe880/internal/stack-architecture-coherence.md`  
`/cursor/stores/bc-824f7a6e-924f-4836-adf3-fd011debe880/internal/code-integrity-audit.md`  
`/cursor/stores/bc-824f7a6e-924f-4836-adf3-fd011debe880/internal/concept-validity-audit.md`

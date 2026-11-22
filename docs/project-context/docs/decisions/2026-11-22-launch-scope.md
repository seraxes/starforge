---
kind: decision
last_verified: 2026-11-22
---
# Decision: launch scope (modules on / archived / migrated)

**Date:** 2026-11-22

**Decision:** Airsoft Nexus is the first production site and uses every module that is already built. Lexical may stay off. InspecTra (a simpler quality-inspection app) may ship before Airsoft Nexus; Core is polished first. Packs not in the tree (Ads, Chat, Shop, Stream) stay absent until built. Nothing built stays off except the possible Lexical exception — do not archive built modules. Migration: users, avatars, and profile settings; no passwords (new password on first login); upcoming events only (past events stay archived on the old site); marketplace user ratings included; marketplace posts are a later examination, not a cutover requirement; everything else stays on the old site.

**Status:** accepted

**Supersedes:** —

**Constraint (one sentence an agent can follow):** For Airsoft Nexus enable every in-tree module except optional Lexical; do not archive built packs; migrate users/avatars/profile settings (reset passwords), upcoming events, and marketplace ratings only.

**Consequences:**

- Launch hardening covers every built pack the site will turn on, not a revenue-floor subset.
- InspecTra may cut over earlier while Core polish continues; it does not remove Social or other built packs from the Airsoft Nexus story.
- Ads / Chat / Shop / Stream remain out of tree until built — absence is not “archived.”
- Cutover tooling must not migrate passwords or past events; marketplace posts wait for a later exam.

**Verification:** Live map Launch scope matches this decision; site module toggles for Airsoft Nexus enable built packs (Lexical optional); migration runbook (when written) covers only the chosen migrate set.

**Choice (recorded):**

### A — Modules on at launch

**A3 — Custom owner set:** Airsoft Nexus uses every module already built. Lexical may stay off. Packs not in the tree stay absent until built.

### B — What is archived (not launched)

**Do not archive built modules.** Nothing built stays off except the possible Lexical exception. Absent packs (Ads, Chat, Shop, Stream) are simply not built yet.

### C — What is migrated (users and events)

**C3 — Users + events + named extras:** Move users, avatars, and profile settings (person sets a new password on first login — do not migrate passwords). Move upcoming events only; leave past events archived on the old site. Include marketplace user ratings. Marketplace posts are a later examination, not a requirement. Everything else stays on the old site.

**Files to update:**

- Rule: none required for a pure enablement list
- Live map: `docs/project-context/docs/architecture-current.md` (Launch scope)
- Owner README: n/a (site/Hero concern); migration runbook when written under ops docs

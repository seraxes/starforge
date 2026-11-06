# Starforge Project Context (offline snapshot)

Snapshot of the Cursor **Project Context** store, synced into the git repo so plans, principles, and preferences can be read offline (e.g. by Zoltan without the live agent store).

## Source of truth

| What | Where |
|------|--------|
| **Live Context** (authoritative for ongoing work) | Cursor Project Agent Store |
| **Live task board** (`notes.md`) | **Not** synced here — remains Context-only |
| **This tree** | Offline / git copy for reference |

When live Context and this snapshot disagree, **Context wins** for the tracker and latest decisions. Re-sync this folder when you want an updated offline copy.

## What was synced

| Path in repo | From Context store |
|--------------|--------------------|
| [`preferences.md`](./preferences.md) | `preferences.md` |
| [`docs/`](./docs/) | Entire `docs/` (plans, audits, specs, kickoffs) |
| [`principles/`](./principles/) | Entire `principles/` |
| `workflows/` | *(none in store at sync time)* |

## Explicitly excluded

- `notes.md` — live task board; not copied
- `internal/` — agent scratch / PR churn; not copied
- `media/` — large reference screenshots/binaries; not copied
- `inbox/` — subscription event payloads; not copied

## Top-level contents

- **preferences.md** — durable product / process preferences
- **docs/** — 38 markdown plans, audits, and specs
- **principles/** — `modular-core.md`, `on-demand-one-worker.md`

### Docs index (filenames)

- `admin-dashboard-benchmarks.md`
- `admin-dashboard-gap.md`
- `admin-dashboard-plan.md`
- `admin-env-editor-plan.md`
- `architecture-opus-audit.md`
- `asn-modules-wireframe.md`
- `auth-recovery-2fa-plan.md`
- `core-gaps-evaluation.md`
- `core-modules-inventory.md`
- `core-remaining.md`
- `design-data-deploy.md`
- `design-module-boundary.md`
- `design-security.md`
- `design-system-overview.md`
- `email-mailer-plan.md`
- `email-manager-plan.md`
- `events-manager-plan.md`
- `form-engine-plan.md`
- `form-feature-gap-analysis.md`
- `i18n-multilang-plan.md`
- `layout-styles-plan.md`
- `local-setup-guide.md`
- `maps-location-plan.md`
- `media-manager-spec.md`
- `media-pipeline-plan.md`
- `module-toggle-architecture.md`
- `modules-wave-kickoff.md`
- `page-settings-plan.md`
- `page-surround-plan.md`
- `payload-admin-theme-plan.md`
- `platform-module-layers.md`
- `project-context.md`
- `replaceable-modularity-plan.md`
- `site-chrome-audit.md`
- `site-chrome-plan.md`
- `site-settings-topics-plan.md`
- `starforge-build-plan.md`
- `starforge-track-audit.md`

## Layout note

Everything lives under `docs/project-context/` so this snapshot does not clobber any future product docs at the repo `docs/` root.

# Starforge — agent index

Start here. This file only points to the sources of truth.

## Where to look

- [Glossary](docs/project-context/docs/glossary.md) — Core, base module, advanced module, Hero, port, `requires`, public door.
- [Live map](docs/project-context/docs/architecture-current.md) — current architecture and open work.
- [Rules](.cursor/rules/) — always-applied Cursor rules (`sf-*.mdc`).
- [Staff bypass](.cursor/rules/sf-staff-bypass.mdc) — app admins / developers may use ownership-gated member actions anywhere.
- [Admin form defaults](.cursor/rules/sf-admin-form-defaults.mdc) — new selects/options on `useActionState` forms must survive post-save reset (controlled or remount `key`).
- [Decision template](docs/project-context/docs/decision-template.md) — record an accepted boundary decision.
- [Decisions](docs/project-context/docs/decisions/) — accepted boundary decisions.
- [Definition of done](.cursor/rules/sf-definition-of-done.mdc) — lint, area tests, `check:atomic` when required.

## Commands

- `npm run dev` — local app
- `npm run lint` — lint
- `npm run test:unit` — unit tests
- `npm run test:e2e` — Playwright page smoke (app must be running; seed for auth routes)
- `npm run test:e2e:ui` — Playwright UI mode for triage
- `npm run check:atomic` — pack boundary check
- `npm run check:docs` — docs link / hygiene check
- `npm run db:migrate` — apply migrations
- `npm run modules:generate` — regenerate module artifacts

## Slice protocol

- One slice per chat. Stop when that slice’s checks pass. Do not start the next slice in the same chat.

## Authority

- When docs disagree, the [live map](docs/project-context/docs/architecture-current.md) wins. If the live map is wrong, say so in the reply and fix it in the same change.
- A boundary change updates the matching rule, the live map, and the owner README in the same change.
- Plans and audits are history. They do not override the live map or the rules.

## Where to put things

- Accepted choices → [decisions](docs/project-context/docs/decisions/)
- Open work → [live map](docs/project-context/docs/architecture-current.md)
- A plan → its own file
- A finished plan → [docs/archive/](docs/archive/)

## Do not touch

- Generated files (`AUTO-GENERATED` headers, `src/generated`)
- [docs/archive/](docs/archive/)
- [scripts/module-boundary-allowlist.json](scripts/module-boundary-allowlist.json)

## Ask before

- Changing a boundary
- Adding a table to another pack
- Enabling a module the live map still has parked

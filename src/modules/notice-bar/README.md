# notice-bar

Layer: particle

Status: built-default-off

## Owns

Dismissible Header notice-bar particle (`noticeBarModule` @ `@/modules/notice-bar`). Seed places it in Header at 100% when used. No `sf_*` tables; particle config only. `defaultEnabled: false`.

Package story and publish notes: [`packages/module-notice-bar/README.md`](../../../packages/module-notice-bar/README.md). Local install: `file:packages/module-notice-bar` via `starforge.modules.json` → `npm run modules:sync`.

## Consumes

None (`requires` / `optionalRequires` empty).

## Public door

none

## Admin surfaces

None. Particle editor via Layouts when the particle is on the canvas. ACL area: none declared.

## Boot and jobs

None. When the pack is on, the particle may be placed in Header.

## Known gaps

- Opt-in only (`defaultEnabled: false`); enable under Settings → Modules when a site wants the bar.

## Tests

None registered in `test:unit` for this pack.

# product:consent

Layer: site pack

Status: shipped

## Owns

Cookie consent banner, choices panel, and `sf-consent` preference helpers. Public UI via `publicShell` `bodyEnd` → `ConsentShell` (Essential / Customize / Accept all; Necessary locked, Analytics optional). Reopen control is the `cookie-settings` layout particle (requires this pack). Gates `atom:analytics` until analytics is accepted. Policy copy under Site Chrome. No `sf_*` tables; preferences live in the consent cookie.

Package story and publish notes: [`packages/module-consent/README.md`](../../../packages/module-consent/README.md). Host adapters: `src/modules/consent/public/ConsentShell.tsx` (banner) and `src/modules/consent/particles/cookie-settings-module.ts` (reopen).

## Consumes

None (`requires` / `optionalRequires` empty). Uses Core layout `publicShell` slots, the layout particle host, and Site Chrome / Chrome policy copy.

## Public door

none

## Admin surfaces

None. Toggle under Settings → Modules. ACL area: none declared.

## Boot and jobs

None. When on, `ConsentShell` mounts at `bodyEnd`. Place `cookie-settings` in a layout outline (default seed: Footer) to reopen preferences.

## Known gaps

- Package sync / publish: see `packages/module-consent/README.md` (`npm run modules:sync`).

## Tests

None registered in `test:unit` for this pack. Related verify script: `verify:consent-cookie` (not part of `test:unit`).

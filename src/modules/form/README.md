# form

Layer: particle

Status: shipped

## Owns

Form **particle** pack (`kind: particle`, id `form`). Layout placement that binds a Forms definition id and renders the public widget. Particle config schema / defaults / editor live here (`formParticleConfigSchema`, `FormParticleEditor`). Nav view deep-links to `/admin/forms`. **No** `sf_*` tables — `product:forms` owns the engine, definitions, submissions, and admin builder.

`product:forms` is the engine. This pack only places a form on a layout. Social’s `optionalRequires` still lists `form` (keep-or-drop is open on the live map); do not remove that edge in docs-only slices.

## Consumes

- **`product:forms`** (hard `requires`) — definition load, evaluate, submit through the Forms engine / `@/modules/forms/api`. Optional Settings → Security captcha (Turnstile) when a form field asks for it.

## Public door

`@/modules/form/api` — `FormWidget`, `FormWidgetProps`. No `api.server`. Client door does not import the particle module barrel (avoids pulling the Forms engine onto the client incorrectly).

## Admin surfaces

No pack admin routes. Nav view `admin` → `/admin/forms` (Forms owns ACL `admin.forms`). Particle cog editor: `FormParticleEditor`.

## Boot and jobs

None.

## Known gaps

- Social still lists `form` in `optionalRequires`; whether to keep or drop that particle id is open (live map / E6).

## Tests

None registered in `test:unit` for this pack. Related verify scripts: `verify:form-particle-binding`, `verify:form-should-slice`, `verify:form-row-layout`, `verify:form-presets-p2` (not part of `test:unit`). Engine unit tests live under `product:forms`.

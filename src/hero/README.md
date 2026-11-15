# Hero

One deployment has one hero. It adds listeners and profile fields on top of the modules. It does not replace a pack’s own handler.

The folder name is the hero id. `starforge.modules.json` sets `"hero": "default"`. Omitting `hero` means `default`. `npm run modules:generate` reads `src/hero/<id>/manifest.ts` and writes:

- `ACTIVE_HERO` in `src/generated/module-registry.ts` — id, label, `skinId`, and `profileFields`. This is data. It does not import `@/hero`.
- `heroBootLoader` / `runHeroBoot` in `src/generated/module-registry.server.ts`. No `boot` on the manifest means the loader is `null`. `src/instrumentation.ts` calls `runHeroBoot` after `runModuleBoot`.

`src/modules` and `src/core` must not import `@/hero`. The boundary checker rejects that edge. A hero file may import another hero file, and it may import `@/modules/<id>/api` and `api.server` only.

## What a hero may declare

| Field | Effect |
| --- | --- |
| `profileFields` | The profile editor renders them with `settings-field` into `extensions[heroId][key]`. An empty list adds no section and does not write `extensions`. Keys stay out of the core `ProfileFieldKey` union. |
| `boot` | Same shape as a pack `boot` (`importPath` + `exportName`). `importPath` must start with `@/hero/`. Use it to call `addFormPresetListener` and `registerPaymentConsumerHook`. |
| `skinId` | Must already be in the skin registry. Generate fails otherwise. This does not add a theme loader. |

## Listeners

Form presets keep one `onSubmitted` owner. `addFormPresetListener` appends. Listeners run after the owner returns. They cannot change `redirectUrl` or the owner message. Their errors are logged and swallowed. The Events checkout redirect still comes from Events.

Payment hooks are a list. A second registration on the same key runs after the first instead of replacing it. Payments updates the order before the list runs. The first handler’s throw still fails the request. Later listeners are logged and isolated so one failure does not skip the rest and does not mark the order paid again.

The default hero registers nothing.

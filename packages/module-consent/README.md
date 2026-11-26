# `@starforge/module-consent`

Cookie consent banner, choices panel, and `sf-consent` preference helpers for Starforge.

- **Allowlist id:** `product:consent`
- **UI:** Essential / Customize / Accept all; choices panel (Necessary locked, Analytics); Cookie settings reopen via `cookie-settings` layout particle
- **Host adapter:** app keeps `src/modules/consent/public/ConsentShell.tsx` (banner) + `cookie-settings` particle (reopen)
- **Install:** `npm run modules:sync`
- **Publish:** GitHub Packages (`publishConfig.registry`)

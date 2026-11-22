# product:pwa

Layer: site pack

Status: built-default-off

## Owns

Progressive Web App foundation — installable Web App Manifest + Serwist service worker. Dynamic `/manifest.webmanifest` from Site Chrome name + Page Settings icons + module knobs. Public shell: `head` (manifest + theme-color) · `bodyEnd` (SW register, production only). Module settings document in `sf_module_settings` id `product:pwa`. Admin `/admin/pwa` — short name, colors, display, start URL, optional MediaPicker icon. Caching: `NetworkOnly` navigations; light `CacheFirst` for `/_next/static` + images + OSM map tiles (live map UX). SW source `src/sw.ts` → `public/sw.js` via `@serwist/next`. No pack `sf_*` tables beyond settings document. `defaultEnabled: false`.

## Consumes

- **`product:media`** (hard `requires`) — optional MediaPicker icon in admin
- Site Chrome name, Page Settings icons

## Public door

none (manifest route + shell components; no `@/modules/pwa/api`)

## Admin surfaces

- `/admin/pwa`
- ACL area: `pwa`
- Toggle: Site Settings → Modules

## Boot and jobs

None as module boot. SW build on `next build` emits `public/sw.js` (gitignored). SW build is **disabled** when `NODE_ENV === 'development'`. Proxy skips `/sw.js` and treats `/manifest.webmanifest` as non-localized. CSP allows `worker-src 'self' blob:`.

## Known gaps

- Not in v0: offline shell, push, custom install CTA, screenshots / shortcuts, background geolocation (use Capacitor — `apps/asn-capacitor`)
- Test installability over HTTPS in production builds

## Tests

`src/modules/pwa/settings.test.ts`

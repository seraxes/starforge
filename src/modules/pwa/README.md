# product:pwa

Progressive Web App foundation for Starforge — **installable** Web App Manifest + Serwist service worker.

## v0 scope

- Opt-in via Site Settings → Modules (`defaultEnabled: false`)
- Dynamic `/manifest.webmanifest` from Site Chrome name + Page Settings icons + module knobs
- Public shell: `head` (manifest + theme-color) · `bodyEnd` (SW register, production only)
- Admin: `/admin/pwa` — short name, colors, display, start URL, optional MediaPicker icon
- Caching: `NetworkOnly` navigations; light `CacheFirst` for `/_next/static` + images + OSM map tiles (live map UX)
- **Not** in v0: offline shell, push, custom install CTA, screenshots / shortcuts, background geolocation (use Capacitor — `apps/asn-capacitor`)

## Wiring

| Piece | Path |
| --- | --- |
| Manifest | `src/modules/pwa/manifest.ts` |
| Settings | `sf_module_settings` id `product:pwa` |
| SW source | `src/sw.ts` → `public/sw.js` via `@serwist/next` |
| Register | `PwaRegister` (module-gated; Serwist `register: false`) |

## Dev notes

- SW build is **disabled** when `NODE_ENV === 'development'` (avoids Turbopack / HMR cache fights).
- Production: `next build` emits `public/sw.js` (gitignored). Test installability over HTTPS.
- Proxy skips `/sw.js` and treats `/manifest.webmanifest` as non-localized.
- CSP already allows `worker-src 'self' blob:`.

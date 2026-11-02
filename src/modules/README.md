# Extension modules (particles)

Product features that hang off Starforge core (not Payload plugins).

## Allowlist (install / build)

Edit [`starforge.modules.json`](../../starforge.modules.json), then:

```bash
npm run modules:generate
```

That regenerates [`src/generated/module-registry.ts`](../generated/module-registry.ts). Optional packs use **dynamic `import()`** loaders only when allowlisted — Site Settings still toggles installed modules at runtime.

| Layer | Role |
| --- | --- |
| Allowlist | Which packs are installed in this build (no deadweight) |
| Site Settings → Modules | On/off for installed packs |

Override allowlist for one run: `SF_MODULES=platform:better-auth,page-content,product:layout-manager,... npm run modules:generate`.

## Particles

| Particle | Id | Notes |
| --- | --- | --- |
| Notice bar | `notice-bar` | Extension — allowlist + Modules toggle |
| Form | `form` | Modular Form engine — needs allowlisted `product:forms` + `form` |
| Page Content | `page-content` | Built-in (core, required) |
| Site Header | `site-header` | Built-in (core) |
| Logo / Image | `logo` | Built-in — image (Media/URL) or **text logo** (font/size/weight/color) |
| Menu | `menu` | Built-in — Nav manager menu set (default = site primary) |
| Copyright | `copyright` | Built-in — text + auto/manual year + link |
| Social | `social` | Built-in — platform/url/label/icon list |
| Custom | `custom` | Built-in HTML/CSS (+ JS stub); free-form escape hatch |

Place particles on the canvas at **`/app/admin/layouts`**. See `src/core/modules/README.md`.

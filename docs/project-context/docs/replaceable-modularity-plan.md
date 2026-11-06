# Replaceable modularity (ports vs modules)

How Starforge keeps base systems replaceable without inventing a second platform. Aligns with [modular-core](../principles/modular-core.md), Site Settings toggles, and [module-toggle-architecture](./module-toggle-architecture.md).

## Two kinds of “modular” (do not conflate)

| Kind | What it is | Examples | Swap mechanism |
| --- | --- | --- | --- |
| **Feature modules** | Product capabilities users turn on/off | Layout, Forms, Notice, Nav, Font Awesome, ASN packs later | Site Settings toggles + (later) `starforge.modules.json` allowlist |
| **Infrastructure ports** | Thin core interfaces with one active adapter | Cache, email, captcha verify, media storage, (long-term) CMS/auth bridges | Env / factory selects adapter; **one** implementation wired at boot |

Feature modules plug *into* Core (registry, palette, admin nav). Ports sit *under* Core so Redis / Spaces / SMTP / Turnstile can change without rewriting product code.

**Rule of thumb:** if Site Settings should hide it from editors → feature module. If ops swaps the backend for the same product behavior → port/adapter.

## Already swappable / modular today

| Area | Status | Notes |
| --- | --- | --- |
| **Site Settings module toggles** | Done (runtime) | `modules.{id}.enabled`; palette, nav, public skip disabled |
| **Particles registry** | Done | `registerModule()` typed particles + Custom escape hatch; Layout owns placement |
| **Form engine** | In flight / foundation | One engine + presets (contact → survey/events/voting/tickets); not parallel builders |
| **Payload as content module** | Done (bridge) | One Better Auth login; CMS access toggle; pages via layout `page-content`; Payload stays a module, not the product core |
| **Captcha** | Partial port | Site Chrome = enable/provider; secrets in env; server-only verify leaf |
| **Email / Mailer** | Done (ports) | Site Chrome enable/provider/From; console / SMTP / Resend; Forms notify wired; secrets in env |
| **Published content cache** | Port stubbed | `PublishedContentCache` + Next default; Redis adapter throws until DO |
| **Auth** | Locked default | Better Auth is the required platform session; not a toy swap target — bridge Payload to it |
| **Layout / outlines / Page Settings** | Feature modules | Gantry-like Core; JSON storage; outline-scoped |

## Abstract next (ports first, thin)

Order by “must be pluggable before DO / depth work,” not by inventing frameworks:

1. **Cache → Redis** — Finish `createRedisPublishedContentCache` behind the existing interface; local stays Next/in-memory. Same port later covers sessions/queues if needed.
2. **Media** — One Payload media library + Starforge pipeline/UI (folders, resize, WebP, mobile upload). Features only tag/ACL/filter. Local disk first; **S3/Spaces storage adapter** when preparing for hosting (SF-28 / SF-66). No second media store for galleries/streams.
3. **Email** — `Mailer` port + Site Chrome enable/provider/From; adapters: console / SMTP / Resend. Forms notify wired. Forgot-password (SF-17) next. Secrets in env only. See [email-mailer-plan](./email-mailer-plan.md).
4. **Captcha** — Keep provider enum + server verify behind a narrow interface (Turnstile now; other providers later). Chrome toggles policy; never put secrets in DB.

**Do not rush full CMS/auth replacement layers.** Payload and Better Auth are locked defaults for Starforge core; keep boundaries clean (core owns users/sessions/extension points; Payload owns editorial collections/media) so a future swap is possible, but do not build dual CMS adapters “just in case.”

## `starforge.modules.json` allowlist

Runtime toggles ≠ no deadweight. Complements [module-toggle-architecture](./module-toggle-architecture.md):

| Phase | Deliverable |
| --- | --- |
| **Now** | Catalog + Site Settings list for *installed* modules |
| **P1** | `starforge.modules.json` presets (`core` / `lean`) → generated `module-registry.ts`; unknown ids / missing `requires[]` fail codegen |
| **P2** | `@starforge/module-*` + `modules:sync` (file: monorepo or GitHub Packages via `STARFORGE_MODULE_SOURCE=registry`); see [module-install-packages](./module-install-packages.md) |
| **P3** | `npm run modules:wizard` writes allowlist then syncs |

Required platform entries (`platform:better-auth`, and Payload when CMS is in the flavor) stay non-disableable or flavor-fixed. Particles/atoms register only via the generated registry.

## How NOT to over-abstract

- **One engine per concern** — Form, media, layout: extend with presets/filters/ACL; do not spawn parallel stacks (modular-core).
- **Ports only at real swap points** — Cache, mail, object storage, captcha verify. Skip generic “Provider” wrappers around code that will never change.
- **No hexagonal cathedral** — Prefer a 20-line interface + factory over DI containers, plugin runtimes, or per-feature repositories.
- **Adapters implement behavior, modules expose product** — ASN marketplace/chat are feature packages on Core, not new auth/CMS cores.
- **Secrets stay in env** — Never Site Settings / Chrome / DB for `PAYLOAD_SECRET`, auth, Turnstile, mail API keys.
- **Document exceptions** — True one-offs that fight the shared engine get a written exception; they do not justify a second general system.
- **Local-first** — Design Redis/Spaces ports now; implement production adapters when approaching DO, not as premature infra theater.

## Success criteria

- Lean site: optional modules absent from bundle/deps via allowlist; toggles still work for installed ones.
- Same Form/media/layout engines reused by contact → events → ASN features without forked field/media UIs.
- Redis/email/Spaces/captcha swap by env/factory without rewriting particles or admin screens.
- Payload remains replaceable *in principle* (core BFF + bridge), without a second live CMS adapter in-tree.

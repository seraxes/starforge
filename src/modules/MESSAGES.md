# Module message contract (i18n P3)

Core merges **Core chrome** catalogs (`src/core/i18n/messages/<locale>.json` — `Auth`, `Layout`, `Locale`, …) with each **enabled** module’s namespaces. Modules never edit Core string tables by hand.

## For new packs (Events, Maps, …)

1. Add `src/modules/<folder>/messages/en.json` (+ `hu.json` and other locales as needed).
2. Declare on the manifest:

```ts
export default defineStarforgeModule({
  id: 'product:events',
  // …
  i18n: {
    namespaces: ['product:events'],
    // messagesDir: 'messages', // default
  },
})
```

3. Run `npm run modules:generate` — codegen emits `moduleMessageLoaders` in `src/generated/module-registry.server.ts`.
4. In UI, use next-intl with the module id as namespace:

```ts
// Client
const t = useTranslations('product:events')
t('registerCta')

// Server
const t = await getTranslations('product:events')
```

## Rules

| Rule | Detail |
| --- | --- |
| **Namespace = module id** | Prefer `product:events`, `product:consent`, … — matches Site Settings toggles. |
| **Allowlist** | Packs absent from `starforge.modules.json` are omitted from generated loaders (no deadweight). |
| **Site Settings off** | Core `loadMergedMessages` skips namespaces for disabled catalog modules. |
| **No Core imports of `@/modules/**`** | Loaders are generated; Core merges via `@/generated/module-registry.server`. |
| **Config / CMS copy stays in DB** | Form field labels, Consent policy message, Email templates — author-edited. Message packs cover **code chrome** (buttons, aria, validation chrome). |
| **Admin UI locale** | P4 — `/admin` stays English-capable via default locale catalogs today. |

## Thin migrations shipped in P3

| Module | Namespace | Examples |
| --- | --- | --- |
| Consent | `product:consent` | Accept all / Essential only / dialog aria |
| Forms | `product:forms` | Sending… / Select… / captcha chrome |
| Email Manager | `product:email-manager` | Dashboard footer + soft-fail hint |

Events declares `i18n.namespaces: ['product:events']` so the pack is ready; add `messages/*.json` when UI strings land — no Core edits required.

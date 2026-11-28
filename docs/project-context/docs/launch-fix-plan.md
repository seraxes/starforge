---
kind: plan
last_verified: 2026-11-28
---
# Launch fix list

Parallel Core / launch polish only. [architecture-current](./architecture-current.md) wins. This file does not move the build queue.

Social polish stays Active. Marketplace cutover stays next. One slice is one chat. The chat ends when that slice’s checks pass.

## Standing

Airsoft Nexus is the launch site. Email verification is a Site Chrome flag (`authRequireEmailVerification`), default off so local sign-in stays unchanged (`src/core/auth/email-verification-policy.ts`). Password minimum stays 8. Staff 2FA stays optional until the owner asks for a code change.

**Shipped in this plan (L1–L7):** `check:tests` / `check:migrations`; `db:core:push` guard; `0082_layouts_skin_id` migration (runtime ALTER removed); last-seat registration and single-use coupon races fixed under transactions; `global-error.tsx`; production CSP drops `'unsafe-eval'`; member chrome message packs for Social, Payments, Profiles, Maps, Marketplace. `0048_drop_payload_schema.sql` stays out of the Drizzle journal on purpose.

**L8 done 2026-11-28:** restore drill dated on [backup-restore](../../ops/backup-restore.md).

## Order

| Slice | Work |
| --- | --- |
| L1 | Register the revenue tests and guard `src/**/*.test.ts` |
| L2 | Push guard, migration checker, `skin_id` migration |
| L3 | Email-verification flag test |
| L4 | Last seat and single-use coupon |
| L5 | `global-error.tsx` |
| L6 | CSP comment and production `unsafe-eval` |
| L7 | Hungarian and English chrome, one module per chat |
| L8 | Restore drill date, after the owner runs the drill |

Paste this for any slice (replace N):

```
Build only slice LN of docs/project-context/docs/launch-fix-plan.md.
Do not start the next slice.
Add the success-path and failure-path tests named in the slice, and register them in test:unit when they live under src.
Run npm run lint and the checks the slice names.
Stop if a check fails. Do not weaken a check to pass it.
```

## L1 — Revenue tests run

Register these in `test:unit`. They exist and are absent from the script today:

- `src/core/payments/money.test.ts`
- `src/modules/payments/coupon-rules.test.ts`
- `src/modules/subscriptions/lifecycle.test.ts`
- `src/modules/email-manager/broadcast.test.ts`
- `src/modules/events/series.test.ts`

Add `scripts/verify-tests-registered.ts` and `check:tests`. Every `src/**/*.test.ts` must be listed in `test:unit`, and every listed path must exist. Leave `e2e/**` and `scripts/**` on their own npm scripts (`verify:module-boundaries` already runs `scripts/verify-module-boundaries.test.ts`).

Fix failures in those five files in this slice. Add `check:tests` to CI next to `test:unit`.

Done when: `check:tests` passes, `test:unit` is green, and the checker test fails on a missing `src` file and on a listed path that does not exist.

Checks: `npm run lint`, `npm run test:unit`, `npm run check:tests`.

## L2 — Database guard rails

Make `db:core:push` refuse unless `STARFORGE_ALLOW_PUSH=1` and `DATABASE_URL` points at localhost.

Add `scripts/verify-migrations.ts` and `check:migrations`. Fail when a `src/core/db/migrations/*.sql` file is missing from `meta/_journal.json`, or when a migration contains `DROP TABLE`, `DROP COLUMN`, or `TRUNCATE` without an `-- approved:destructive <reason>` line. Allow `0048_drop_payload_schema.sql` once, with a comment that quotes the file: it runs after the idempotent `sf_*` copy and must not be in the journal. Do not add `0048` to `_journal.json`.

Read `scripts/db-migrate.mts` before touching CI. Remove the `CREATE SCHEMA payload` steps in `.github/workflows/ci.yml` only when that script no longer needs the schema present before the copy.

Add a migration that `ADD COLUMN IF NOT EXISTS "skin_id" text` on `sf_layouts`. Then remove the runtime `ALTER TABLE` in `ensure-layout-skin-id.ts` and its call from `src/core/modules/layout-store.ts`. Update the `sfLayouts` comment in `src/core/db/schema.ts` so it no longer tells anyone to apply `skin_id` with `db:core:push`.

Done when: `check:migrations` passes on the repo, and its tests fail on a missing journal entry and on an unapproved `DROP COLUMN`. The push guard tests fail without the env flag and when `DATABASE_URL` is not localhost.

Checks: `npm run lint`, `npm run test:unit`, `npm run check:migrations`, `npm run check:atomic`.

## L3 — Email verification flag

Keep the code default off. Add tests for the existing policy:

- Success: `applyAuthEmailVerificationPolicy(false)` leaves sign-in allowed for an unverified account at the policy layer.
- Failure: `applyAuthEmailVerificationPolicy(true)` makes `isAuthEmailVerificationRequired()` true, and the sign-in path this repo already uses refuses an unverified account.

Add one line to [production-env-checklist](../../ops/production-env-checklist.md): Airsoft Nexus production turns Site Chrome “require email verification” on. Do not change `minPasswordLength`. Do not require staff 2FA in this slice.

Checks: `npm run lint`, `npm run test:unit`, `npm run check:docs`.

## L4 — Last seat and single-use coupon

Last seat: two overlapping `createEventRegistration` calls for the last seat of an event or tier must leave one `registered` row. The loser gets the waitlist when `waitlistEnabled` is on, or the existing full-event error when it is off. Put the count and the insert in one transaction that cannot admit two winners. Stay in `src/modules/events/registrations.ts`.

Single-use coupon: `recordCouponRedemption` must not keep a redemption row when the conditional `usedCount` update changes zero rows. Same `usageLimit: 1` and two different order ids → one redemption, `usedCount === 1`. Stay in `src/modules/payments/coupons.ts`. Do not add a second coupon table.

Double-delivered payment webhook: one test that the existing `idempotencyKey` unique index leaves one order. Extend that path only if the test shows a second paid order.

Marketplace stock stays out. Upcoming events migrate; marketplace posts do not.

Done when: each race test has one winner and a refused or waitlisted loser.

Checks: `npm run lint`, `npm run test:unit`.

## L5 — Root error surface

Add `src/app/global-error.tsx`. Keep the locale `error.tsx` and the two `not-found.tsx` files. Do not add a `loading.tsx` per route.

The failure path is a render test or a small unit test that the global error module exports a default component and does not call a digest or stack into the visible markup.

Checks: `npm run lint`, `npm run test:unit`.

## L6 — CSP runtime comment

In `src/core/security/csp.ts`, replace the comment that still blames the Payload admin. Production `script-src` drops `'unsafe-eval'` when `npm run build` and `verify:csp-sources` still pass. If the production build needs `'unsafe-eval'`, keep it, name the dependency in the comment, and add one open-work row on the live map. Leave `'unsafe-inline'` in place. Do not start a nonce migration.

`dangerouslySetInnerHTML` stays the existing open-work row on the live map. This slice does not review those sites.

Checks: `npm run lint`, `npm run test:unit`, the CSP verify script, and a production build when `'unsafe-eval'` is removed.

## L7 — Hungarian and English chrome

One module per chat, in this order. Each chat adds `messages/en.json` and `messages/hu.json` for that module, or moves inline chrome into the files that already exist. Keys match in both files. Editor-typed copy stays on `data/content-locales/{locale}/` and `LocaleInput`. A native speaker reviews Hungarian later; this slice only lands the keys and a faithful Hungarian pass.

1. Social inline chrome, into the existing message files.
2. Payments.
3. Profiles.
4. Maps.
5. Marketplace.

Events, Forms, Email Manager, Pages, Media, and Consent already have both files. Touch one of those only when a string in that module is still inline chrome.

Onboarding, Documents, and Ads wait until that pack is the active lane.

Done when: the module’s chrome keys exist in both locales, and a test or the existing i18n verify script fails when a key is only in one file.

Checks: `npm run lint`, `npm run test:unit`, `npm run check:docs` when a doc link changes.

## L8 — Restore drill date

Owner work, not an agent slice, until a restore has actually been run. Follow [backup-restore](../../ops/backup-restore.md). Restore into a scratch database, boot the app against it, then replace the `TODO(owner)` drill line with the date and the result. Do not add a new runbook.

## Already tracked elsewhere

Leave these on the live map or in their pack plans. They are not slices here.

- Social polish, then Marketplace cutover.
- `dangerouslySetInnerHTML` sanitization review.
- Documents signature webhook route. The door stays fail-closed on `authorized`. Mount HMAC verification only when a site turns Documents on.
- Ads, Chat, Shop, Fleet, Scan, Capacitor.
- Module build-exclusion (`modules:sync` target on the live map).
- `CHECK` constraints and jsonb `schemaVersion` across packs.
- Splitting large editor files, `styles.css`, or the `verify-*.mts` scripts.
- A second full-repo audit.

## Done when

L1 through L7 are green in their own chats. L8 has a dated restore line written after a real drill. The build queue on the live map is unchanged.

# Core host gaps — instructions for Auto

**Model:** Cursor Auto or Composer. One slice per chat. Do not start the next slice in the same chat.

**Read first:** [architecture-current](./architecture-current.md) and `.cursor/rules/sf-ui-design.mdc`.

**Rules for every slice**

- Copy an existing screen. Public errors copy `src/app/(frontend)/(public)/[locale]/not-found.tsx`. Account actions copy `src/app/(frontend)/(public)/[locale]/account/security/account-security-panel.tsx`. Admin toggles copy `src/app/(frontend)/admin/settings/auth/auth-settings-form.tsx`.
- Auth mail goes through `sendAuthMail` in `src/core/auth/mail.ts`, which already uses the Mailer port. Do not add SMTP code.
- Secrets go in the Environment editor catalog (`src/core/env-editor/catalog.ts`) and `.env`. Never in the database.
- Do not add a second login, a second mailer, a second job library, or a second drag canvas.
- Do not touch Events, Maps, Payments product behavior, Particle Defaults, or Payload collections.
- Do not commit unless the user asks.

Paste only the slice below into the chat.

---

## Slice 1 — Public error / 404 as pack outlines

Each skin pack seeds **Offline** + **404** system outlines beside Base. Those outlines **are** the offline and 404 pages for the active skin (not in Navigation). `/site-offline` and `/site-not-found` are plumbing only (503 rewrite + error recovery).

**Do**

- Seed `{skinId}-not-found` on the default Pastel pack (inherit Base, omit navigation) — same shape as Offline.
- Add `/site-not-found` + `SiteNotFoundView` that resolves the active skin’s `*-not-found` outline.
- Locale `not-found.tsx` renders `SiteNotFoundView` (visitor-safe copy; no seed/CMS developer lede).
- Add `src/app/(frontend)/(public)/[locale]/error.tsx` (client). It must not show stack / framework messages. Recover with `window.location.replace('/site-not-found')`.
- Offline page is the active skin’s outline (Site Chrome picks which one; default `*-offline`).

**Done when**

- Locale 404 and `/site-not-found` plumbing show the active pack’s 404 outline.
- A thrown error under `/[locale]/…` ends on `/site-not-found` without exposing internals.
- `npm run test:unit` still passes.

---

## Slice 2 — Email verification

Turn on optional email verification with the auth that already exists.

**Do**

- In `src/core/auth/index.ts`, `emailAndPassword.requireEmailVerification` follows a site setting. Default for existing databases stays **off**, so local sign-in does not break.
- Add the toggle on **Settings → Auth & registration** (`auth-settings-form.tsx`), same `settings-field settings-flag` pattern as the magic-link switch. Label: “Require email verification”.
- Send the verification message with a new `AuthMailKind` of `email-verification` inside `sendAuthMail`. Subject and body in plain text plus simple HTML. No new template engine.
- Better Auth’s `emailVerification.sendVerificationEmail` is the only send hook. Persist the flag in the same store the other auth toggles already use. Find that store before adding a table.
- The login and register screens, when the flag is on, tell the user to open the email. When the flag is off, they behave as they do today.

**Do not**

- Do not set the default to on.
- Do not call `getMailer()` from a new file. `sendAuthMail` is the only sender.
- Do not build a second verification code system beside Better Auth.

**Done when**

- Flag off: register still signs the user in.
- Flag on: register sends one verification email through the Mailer, and sign-in waits until the link is used.
- The Environment editor is untouched (no new secret).

---

## Slice 3 — Download my data, delete my account

A signed-in member can export their account and delete it. Admins are unchanged.

**Do**

- Add both actions to the existing account security page: `src/app/(frontend)/(public)/[locale]/account/security/`.
- **Download** returns a JSON file for the signed-in user only: account id, name, email, when the account was created, profile fields if `product:profiles` is installed, and that the user has sessions. Omit password hashes, two-factor secrets, session tokens, and merchant payment keys.
- **Delete** asks for the current password, then deletes that user through Better Auth, signs them out, and sends them to `/[locale]/login`. Show the result with the same inline error pattern as the two-factor panel.
- Buttons use `gantry-btn`. Delete is not the orange primary. Put the two actions at the bottom of the security card, right-aligned, matching `page-settings-actions`.

**Do not**

- Do not add an admin “delete any user” screen. User admin already exists.
- Do not delete payments or events rows by inventing new business rules. Delete the auth user. If a foreign key blocks that, stop and report the table. Do not cascade through Events or Payments in this slice.

**Done when**

- A member can download only their own JSON while signed in.
- A wrong password does not delete the account.
- A second user cannot delete the first by calling the action with the other id.

---

## Slice 4 — Job runner port

Add a Core port so work can finish after the HTTP request. One interface, one adapter.

**Do**

- Create `src/core/jobs/` with:
  - `types.ts` — `JobRunner` with `enqueue({ name, payload, runAt? })` and `info()`.
  - `memory.ts` — runs the handler in-process. If `runAt` is in the future, use a timer. This is the default when `REDIS_URL` is empty.
  - `index.ts` — `getJobRunner()` chooses the adapter. Same shape as `src/core/mail/index.ts`.
- Handlers register by name in this folder: `registerJobHandler(name, fn)`. Unknown names return an error. They do not throw through the request that enqueued them.
- Add a unit test: enqueue a named job, the handler runs once, a second enqueue with the same idempotency key does not run it twice.
- Export the port from `src/core/index.ts`.

**Do not**

- Do not add BullMQ, a new npm queue package, or a worker process.
- Do not move the payments fiscal outbox onto this port in this slice. A later slice may call `enqueue` from that outbox.
- Do not store secrets in the job payload.

**Done when**

- The unit test passes with no Redis.
- Calling `getJobRunner().info()` reports `memory`.
- No product screen was added.

---

## Slice 5 — Google sign-in

Add Google as an optional provider on the existing Better Auth instance.

**Do**

- Enable `socialProviders.google` in `src/core/auth/index.ts` only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set. When they are empty, email login is unchanged and no Google button renders.
- Add both keys to `src/core/env-editor/catalog.ts` as secrets, next to `BETTER_AUTH_SECRET`.
- On `src/app/(frontend)/(public)/[locale]/login/page.tsx`, add one button, “Continue with Google”, that calls Better Auth’s social sign-in. Use `gantry-btn`, not a new button style. Hide it when the env pair is missing. Pass that flag from the server page. Do not read the secret in the client.
- New Google users become normal `sf_users` members. They use the same session cookie as email login. Groups and ACL are unchanged.

**Do not**

- Do not add Apple, Facebook, or a provider framework in this slice.
- Do not create a second user table.
- Do not require Google for registration.

**Done when**

- Empty Google env: the login page looks as it does today, and auth still boots.
- Both env values set: the button is visible and starts the Better Auth Google redirect.
- The client bundle does not contain `GOOGLE_CLIENT_SECRET`.

# Auth recovery, passwordless, and 2FA (SF-17)

Ship forgot-password / login-email reminder / passwordless / stay-signed-in / full TOTP 2FA on the **existing Better Auth + Mailer** stack. No second auth product.

## Stack (first-party only)

| Need | Better Auth surface |
| --- | --- |
| Forgot password (link + token) | `emailAndPassword.sendResetPassword` → `requestPasswordReset` / `resetPassword` |
| Forgot login email | App action + Mailer reminder (login id is email; not the username plugin) |
| Magic link | Plugin `magicLink` (`disableSignUp: true`) |
| Email OTP sign-in | Plugin `emailOTP` (`disableSignUp: true`) |
| Stay signed in | `rememberMe` on password sign-in |
| Authenticator 2FA + recovery codes | Plugin `twoFactor` (TOTP enable/verify/disable, backup codes, login challenge) |

Mail goes through `getMailer()` / `sendMail()` (Site Chrome enable + provider; SMTP/Resend secrets in env).

## Public routes

- `/forgot-password`, `/reset-password?token=…`
- `/forgot-username` (sign-in email reminder)
- `/login` — Password / Magic link / Email code tabs + helper links
- `/two-factor` — TOTP or recovery code after password when 2FA on
- `/account/security` — enable/disable TOTP, show/regenerate recovery codes

## Schema

- `sf_users.two_factor_enabled`
- `sf_two_factors` (Better Auth `twoFactor` model)

`npm run db:core:push` after pull.

## Test with Environment SMTP

1. Site Chrome → Email: enable, provider **SMTP**, From set.
2. Environment editor (or `.env.local`): `SMTP_HOST` / `PORT` / `USER` / `PASS` / `SMTP_SECURE`.
3. Restart Node so env reloads.
4. Forgot password → check inbox for reset link → `/reset-password`.
5. Login → Magic link / Email code tabs.
6. Account security → enable 2FA → sign out → password login → `/two-factor`.
7. Local without SMTP: provider **Console** — codes/links appear in the server log.

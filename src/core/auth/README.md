# Starforge core — auth module (stub)

This directory is the **product auth / session boundary**.

- App users, sessions, and authorization hooks will live here (Drizzle + `public` schema).
- Payload’s `users` collection is **CMS editors only** (`src/collections/Users.ts`).
- Do not route high-QPS app login/session traffic through Payload Local API.

Next steps (after this scaffold): sessions, password/OAuth providers, and wiring the app shell to core auth — not Payload auth.

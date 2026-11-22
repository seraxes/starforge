---
kind: decision
last_verified: 2026-11-23
---
# Decision: media access model for non-public files

**Date:** 2026-11-22

**Decision:** A file or object keeps its access level. A user must not attach it to a post or any other object with a wider audience (e.g. a friends-only photo cannot be placed on a public post). Serve path honors the same access: Social-bound non-public files 404 for viewers `canViewBoundMedia` denies. Do not add a law to `sf-security.mdc` while that file is absent (always-apply budget).

**Status:** accepted

**Supersedes:** —

**Constraint (one sentence an agent can follow):** Refuse binds where the target object's audience is wider than the file's access level; `/api/media/[id]` and `/api/media/file/[...key]` must call Social’s serve gate before redirect or bytes.

**Consequences:**

- Attach-time and serve-time checks are both shipped (Social decide + app media routes).
- Forms may keep forcing private for `folder=forms`.
- `product:media` must not import Social; app routes call `@/modules/social/api.server`.

**Verification:** Attach refuses wider audiences (`audience_too_wide`). Serve: `media-serve.test.ts` covers public / friends allow and friends-stranger / only_me deny; live map serve row Done.

**Facts (current):**

- Media schema has `private` (`isPrivate`) on `sf_media_*`.
- Form uploads are treated as private; ordinary library files can be public.
- Attach: `decidePostAttachments` / `decideSetPostAudience` use `shareAudienceIsWider` + passed-in file level.
- Serve: `decideSocialMediaServeAccess` + `canViewBoundMedia` (reuses `canViewPost`) on the Social door; both media routes gate before serve.

**Choice (recorded):** File/object retains its access level; binding to a wider-audience object is refused. Serve path honors the same access.

**Files to update:**

- Rule: skipped — `sf-security.mdc` does not exist; always-apply rules already over 15 KB
- Live map: serve row Done
- Owner README: `src/modules/media/README.md`, `src/modules/social/README.md`

---
kind: reference
last_verified: 2026-11-22
---
# product:social — Composer build plan

**Status:** parked. [architecture-current](./architecture-current.md) still wins. The next product pack on that map is ads. This file is the build spec for when a Composer chat starts Social. It does not change the queue.

## Composer stage

The home composer is the feed card (`sf-social-feed-item`), not a stack of fields and not a dialog. A quiet strip under the feed tabs grows in place when the member focuses it or uses an instrument. Photo, link, vote, and place each add one block, and only when that pack switch is on. A second block asks before it replaces the first. The client submits only the active block through `createTextPostAction`. A pasted `http(s)` URL becomes the link card; Post still fills the preview on the server. Challenge and the Watch chip are a later pass. This does not add a post kind or a table, and it does not move Social ahead of ads.

**Builder:** Composer 2.5. One slice is one chat. The chat ends when that slice’s tests pass. Do not start the next slice in the same chat.

## How to run a chat

Paste this, and replace N and the slice line:

```
Build only slice N of docs/project-context/docs/social-feed-plan.md.
Do not start the next slice.
Follow the Rules, the Uniqueness list, and Every slice.
Add node:test cases for the success path and the failure path named in that slice.
Register the test file in the test:unit script in package.json.
If you touch the manifest, schema.ts, or a public door, run npm run check:atomic.
Stop if a test or check:atomic fails.
```

Tests use `node:test` and `tsx`, the same style as [catalog.test.ts](../../../src/modules/subscriptions/catalog.test.ts).

Copy the nearest finished pack for chrome and registration. Manifest shape: [src/modules/subscriptions/manifest.ts](../../../src/modules/subscriptions/manifest.ts), then import it from [src/modules/manifest-index.ts](../../../src/modules/manifest-index.ts) the way subscriptions is imported. Particle shape: [subscription-plans-manifest.ts](../../../src/modules/subscriptions/particles/subscription-plans-manifest.ts). Admin chrome: Events settings. Public door: `@/modules/social/api` and `api.server`. Private files stay inside the pack.

## Rules

- Pack id `product:social`, label Social, routes under `/feed`. Do not reuse the built-in particle id `social` (footer links). Live video stays `product:stream`.
- `requires`: `product:profiles`, `product:media`, `product:rich-editor`, `product:forms`, `product:email-manager`, `product:payments`, `product:maps`.
- `optionalRequires`: `product:subscriptions`, `product:events`.
- Call those owners. Do not copy their tables, carts, mailers, media libraries, form builders, or map clients. Do not call `getMailer()`.
- User ids are plain text. No foreign key to the auth user.
- `canViewPost(viewer, post)` is the only read check for one post. A feed query uses a SQL predicate that matches it, then paginates. It does not load a page and drop rows in memory. Slice 4 ships the predicate for the audiences that feed already queries, plus a parity test that runs the same cases through `canViewPost` and the predicate. Later slices that add a feed audience extend both and extend the parity test.
- Group and page membership are inputs to `canViewPost` (`isGroupMember`, `isPageLiker`, `isPageAdmin`). Slice 3 tests them with a fake context. Slice 13 replaces the group lookup. Slice 15 replaces the page lookup. Do not build groups or pages early to satisfy those tests.
- `canInteract(a, b)` is the write check. It is false when either person has blocked the other, either account is hidden, or either member is banned. Comments, follows, mentions, group invites, story viewers, and shares call it. They do not re-derive the block rule.
- Post audience is one of `only_me`, `group`, `friends` (default), `public`. The personal composer’s group choice lists groups the author owns. A member may still post on a group wall they do not own. A page post is visible to likers and page admins.
- `canViewPost` is false when either person has blocked the other, the author account is hidden, or the post is staff-hidden. The author can still see their own post. `social.posts` manage can see a hidden post in the review queue.
- Reserved handle words are the path segments directly under `/feed`: `people`, `groups`, `pages`, `stories`, `following`, `discover`, `watch`, `requests`, `saved`, `post`, `tag`, `c`, `g`, `p`, `u`. A slice that adds another segment adds the word to this list in that same slice. Those profiles link at `/feed/u/[handle]`.
- A report row always has `postId`. `commentId` is optional. Stories, groups, and pages have no Report control.
- Account hide keeps rows. Purge runs only when Core asks after the retention wait and a final admin approval. This pack does not build the one-year clock. A staff account is not hidden by the member flow.

## Account retention (Core)

Built in Core, not in Social. `deleteAccountAction` hides a normal member instead of calling `deleteUser`. Core stores `hiddenAt` and `purgeEligibleAt` on `sf_users`. The default wait is one year, from Core `sf_site_settings.account_retention_days`. Rows stay. Public pages treat the account as absent. Sign-in during the wait offers restore, which clears the clock. A staff member with the restore grant can restore it too. A legal hold keeps the rows past the year. Final delete is a separate approval, only after `purgeEligibleAt` and only when no hold is set. That approval calls each pack’s purge door through `loadModuleDoor`, including `purgeOwnSocialRecord`, then deletes the auth user. A staff account cannot be hidden or finally deleted by the member flow, a Moderator, or an Administrator. Only a different Super Administrator or Developer can do that, and not their own account. The five role names are not built yet — refuse when the target is a staff account unless the actor is already an app admin who is not that user. Social only supplies `hideOwnedSocialContent` / `purgeOwnSocialRecord` when Core asks.
- Do not add an Access Level entity. Grants are `social.posts` and `social.reports` at view, edit, or manage. A ban is a Social `bannedAt`, not a Core role change and not an account delete.
- Points, badges, support tickets, chat, the notification bell, and live video are other packs. Social does not store them.
- Hero airsoft fields go in `extensions` jsonb, not new columns on `sf_social_*`.
- `product:payments` is required so Social never grows a cart. No slice calls it until a charge exists. `product:maps` is required with Social. The check-in test is “the Maps door failed, the label still saved,” not a supported mode where Maps is turned off.
- One job, `social.sweep`, registered in slice 12. Slice 16 adds story expiry to that same job. Do not register a second runner.
- Block stays one friendship row per pair. Unfriend of a blocked pair is already refused. Slice 7 adds a second blocker column so each person can block without erasing the other, and only a recorded blocker can clear their own side. Visibility stays false while either side is set.

## Every slice

- New routes, particles, nav links, and the sweep do nothing when Social is off.
- A new `sf_social_*` table is registered with export, hide, and purge. From slice 10 on, a test lists the tables in `schema.ts` and fails if one is missing from that registry.
- Deleting a post removes, in the same transaction, every row that points at that post by any column (comments, likes, saves, shares). Deleting a parent comment deletes its one reply. Report rows are kept. The queue shows the post as deleted. An author cannot erase a report by deleting the post.
- Include one blocked-user case, through `canInteract` or `canViewPost`, whenever the slice writes or lists a relationship.
- Name the failure path in the slice. Do not invent a different one and do not skip it.

## Uniqueness

Create the unique key in the slice that creates the table. A second insert updates the open row or is refused. Do not rely on a read-then-insert.

- Friendships: one row per pair.
- Reactions: one row per `(actorUserId, targetType, targetId)`. This key is not the challenge vote.
- Challenge likes: `sf_social_challenge_likes`, unique `(actorUserId, challengeId)`. Moving a like updates that one row. It does not insert a second reaction.
- Reports: one open row per reporter per post.
- Follows: one row per pair.
- Poll votes: one row per `(postId, userId)`.
- Activity cards: one row per `(sourceModule, sourceId, activityKind)`.
- Story views: one row per `(userId, storyId)`.
- Page likes: one row per `(userId, pageId)`.
- Album items: one row per `(albumId, mediaId)`.

## Slices

1. **Shell.** Manifest, `schema.ts`, public door that returns immediately when Social is off, admin settings stub. Test the off door. `check:atomic`.
2. **Friends.** Request, accept, decline, cancel, unfriend, block. Tests: second accept, request after block, unfriend.
3. **Posts.** Text posts, four audiences, `canViewPost`, permalink not-found, reserved handles. Tests: only me, group and non-member, friends, public, block, hidden author.
4. **Feed.** Done. Home feed, text composer, member route, `social-friends` particle, nav link Social. The SQL predicate is slice 7b, not a rework of this slice.
5. **Media.** Done. `MediaPicker` on a post. Up to 10 images, or one video, not both. The file stays in Media. Social does not serve bytes. `/api/media/[id]` is public for ordinary files, so `canViewPost` does not hide the file. Do not add a Social file route in this slice. A later Media change can mark non-public social attachments private. Tests: unknown `mediaId` refused, an id the Media door will not read for this member refused, 11 images refused, image plus video refused.
6. **Like.** Done. Build `canInteract` here. It is false when either side has blocked, either account is hidden, or the banned flag is set. Banned is a fake input until slice 9b. Truth-table test those three. One reactions row, kind `like` only. Not the challenge vote. Tests: a second kind is refused, and a like on a post `canViewPost` denies is refused.
7. **People.** `/feed/people`, the People nav link, and email id `product:social/friend.requested`. Omit hidden and blocked people. Add the second blocker column. Update `canViewPost`, `canInteract`, and the pair query. Tests: a mutual block, each side clears only its own, a request after a block is refused, and a mail failure does not roll back the request.
7b. **Feed query.** Done. Replace the load-then-filter home feed with a SQL predicate that matches `canViewPost`, then paginate. Done when a parity test covers audience, friendship, block, and hidden author, and a page does not come back short. Build this after slice 7, before slice 13. Slices 5 and 6 do not wait for it.
8. **Comments.** Two reply levels. A comment on the post can be replied to, and that reply can be replied to once. A third level is refused. Author can edit or delete their own post or comment. Deleting a comment deletes the replies under it, including replies to those replies. Deleting a post deletes its comments and its likes in one transaction. Staff hide of a post. Test: a third reply level is refused. `canInteract` is already built in slice 6. Call it. Do not rebuild it.
9. **Reports.** `postId` required, optional `commentId`. Test: a report with no post is refused.
9b. **Moderation.** Review queue. Hide or restore a post or a comment. Resolve a report. `bannedAt` replaces the fake banned input from slice 6. A banned member fails `canInteract` on post, comment, challenge, and request. Test: a banned member’s post is refused. Own chat if it does not fit in slice 9.
10. **Account doors.** `exportOwnSocialRecord`, `hideOwnedSocialContent`, `purgeOwnSocialRecord` through `loadModuleDoor`. Tests: hide keeps the rows, the member action does not call purge, and every `sf_social_*` table in `schema.ts` is in the registry. Core retention is a different chat.
11. **Activity.** `publishActivity` on the Social door. Events and Pages callers are their own chats. A Social failure does not fail their publish. Test: the door returns without writing when Social is off.
12. **Challenge.** Done. `endsAt` is `publishedAt` plus `lengthDays` times 24 hours. If the accept window is 24 hours, `endsAt` must be at least 1 day after start. If it is 48 hours, `endsAt` must be at least 2 days after start. Accept and upload deadlines are `min(phase end, endsAt)`. Likes live in `sf_social_challenge_likes`, one row per person per challenge. Entrants cannot like. No share. Register `social.sweep` and the challenge handler. The entitlement key is `social.challenge.multi`. When Subscriptions is off, refuse a second invite and do not link to `/plans`. When Subscriptions is on and `hasEntitlement(userId, 'social.challenge.multi')` is false, refuse and link to `/plans`. A mail failure does not roll back the invite. Test: a 48-hour window with `lengthDays` 1 is refused.
13. **Groups.** Done. Categories `general`, `team`, `association`. Membership, wall posts, directory `/feed/groups` and `/feed/g/[slug]`, invite mail, `social-groups`. Test: a non-member fails `canViewPost`.
14. **Team tools.** Ranks, documents through Media, announcements (`product:social/group.announced`), Forms `formDefinitionId`. Test: a rank cannot remove the owner or an admin. Only the owner deletes or transfers the group. Events `hostModule`, `hostKind`, `hostId` is an Events chat, not this one.
15. **Pages.** `sf_social_pages`, admins, likes, page posts, `verifiedAt`, `/feed/pages` and `/feed/p/[slug]`, optional `sitePageId`, `social-pages`. Test: a non-liker cannot view a page post. Page-hosted events use `hostKind = page` in the Events chat.
15b. **Admin — composer and feed.** Done. Pack switches and limits in the Admin map. `sf_module_settings`, Events chrome, Save bottom-right. Test: an unknown audience is refused, and a disabled post kind cannot be created.
15c. **Admin — people, reactions, reports.** Done. Ban list, hidden posts, reaction toggles, report reasons, auto-hide threshold. Test: unban clears `bannedAt`, and a disabled reaction kind is refused.
15d. **Admin — groups and pages.** Creation rules, categories, verified lists. Test: a category kind outside `general`, `team`, and `association` is refused.
15e. **Admin — stories, albums, media, challenge.** Done. Lifetime, album cap, images-per-post cap, challenge windows. Test: a story lifetime outside 1–48 hours is refused.

## Admin map

EasySocial puts a switch on every feature the member can use. Social does the same for the features this pack owns. The hundreds of EasySocial fields that edit profiles, points, chat, marketplace, events, registration, or email templates stay in those packs. `/admin/social` is the composer and feed Pack panel (slice 15b). Reports already has its queue.

**Composer and feed** (`/admin/social`, slice 15b).

- Module status, read-only, link to Settings → Modules.
- Default post audience.
- Guest can read public posts.
- Feed page size.
- Switches: text, media, link, share, poll, check-in, challenge, mentions, hashtags, comments, discover, following tab, short-video layout.
- Activity cards: `event.published`, `page.published`.
- Comment length limit.
- Hold new posts for staff review, default off.

**People and reactions** (`/admin/social/people`, slice 15c).

- Friend requests on or off. Max pending requests per member.
- Default friend-list visibility.
- Follow on or off.
- Banned members, with ban and unban.
- Reaction kinds: `like`, `love`, `haha`, `wow`, `sad`, `angry`. `like` starts on. Reactions on comments. Reactions on stories.
- Report reasons list. Auto-hide a post after N open reports.
- Staff-hidden posts, with hide and restore.
- Word list that refuses a post or comment.

**Groups** (`/admin/social/groups`, slice 15d).

- Groups on or off. Who can create one. New groups need approval.
- Default join rule, open or closed. Max members, 0 for no cap.
- Categories: name, slug, kind `general`, `team`, or `association`.
- Group list: owner, category, verified flag.
- Switches: documents, announcements, join form.
- Ranks stay on the group page.

**Pages** (`/admin/social/pages`, slice 15d).

- Pages on or off. Who can create one. New pages need approval.
- Page list: owner, verified flag, site-page id.
- Likes on or off.

**Stories, albums, media, challenge** (`/admin/social/media`, slice 15e).

- Stories on or off. Lifetime hours, default 24, range 1–48.
- Albums on or off. Max items per album.
- Max images per post, default 10. Video on a post on or off. Image plus video stays refused.
- Challenge on or off. Allow the 24-hour window. Allow the 48-hour window. Min and max length in days. Premium invite cap.

**Mail.** Links only, to Email Manager, for `product:social/friend.requested`, `product:social/group.announced`, and the challenge triggers.

**Not here.** Payments, Forms, Media library, Events, Profiles, role names, Gamification, Chat, and the one-year retention clock.

16. **Stories.** Done. 24 hours, seen and unseen, author viewer list. Add story expiry to `social.sweep`. The media file stays. `/feed/stories`, `social-stories`. Test: an expired story is hidden. A blocked viewer is omitted from the viewer list. 24 hours, seen and unseen, author viewer list. Add story expiry to `social.sweep`. The media file stays. `/feed/stories`, `social-stories`. Test: an expired story is hidden. A blocked viewer is omitted from the viewer list.
17. **Albums.** Member, group, and page. Files stay in Media. Test: an unknown `mediaId` is refused.
18. **Share and links.** Test: a private address is refused, a challenge cannot be shared, a share omits a target `canViewPost` denies, and a share is refused when `canInteract` is false.
19. **Follow.** `sf_social_follows` and a Following tab of public posts. Test: a follow after a block is refused.
20. **Mentions, tags, saves.** `/feed/tag/[tag]` and `/feed/saved` use `canViewPost`. Test: saving a post the viewer cannot see is refused. A mention of a blocked member does not notify them.
21. **Polls, then check-in.** Done. Closed poll cannot be edited. If the Maps door fails, the check-in label still saves. Test both.
22. **Discover, reaction catalog, short-video layout.** Split into separate chats if they do not fit in one. Discover test: a friends-only post is absent. If discover gets its own path under `/feed`, add that word to the reserved handles in this slice. Short-video test: a non-video post is absent from the short-video layout (`/feed/watch`; reserved handle `watch`).
23. **Later packs, one chat each, only when that pack exists.** `recordAction` to Gamification (`social.post.created`, `social.comment.created`, `social.reaction.created`, `social.story.created`, `social.challenge.completed`). Search index. Notifications trigger list. Chat story replies.

## First chat

Slice 1 only. Do not add tables beyond what the shell needs to boot, and do not add posts or friends.

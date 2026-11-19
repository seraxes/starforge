# product:social — Composer build plan

**Status:** parked. [architecture-current](./architecture-current.md) still wins. The next product pack on that map is ads. This file is the build spec for when a Composer chat starts Social. It does not change the queue.

**Builder:** Composer 2.5. One slice is one chat. The chat ends when that slice’s tests pass. Do not start the next slice in the same chat.

## How to run a chat

Paste this, and replace N and the slice line:

```
Build only slice N of docs/project-context/docs/social-feed-plan.md.
Do not start the next slice.
Follow the Rules and the Uniqueness list.
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
- `canViewPost(viewer, post)` is the only read check for a post. Feeds, permalinks, shares, hashtags, discover, and group walls call it. They do not repeat the rules.
- Post audience is one of `only_me`, `group`, `friends` (default), `public`. The personal composer’s group choice lists groups the author owns. A member may still post on a group wall they do not own. A page post is visible to likers and page admins.
- `canViewPost` is false when either person has blocked the other, the author account is hidden, or the post is staff-hidden. The author can still see their own post. `social.posts` manage can see a hidden post in the review queue.
- Reserved handle words: `people`, `groups`, `pages`, `stories`, `requests`, `saved`, `post`, `tag`, `c`, `g`, `p`, `u`. Those profiles link at `/feed/u/[handle]`.
- A report row always has `postId`. `commentId` is optional. Stories, groups, and pages have no Report control.
- Account hide keeps rows. Purge runs only when Core asks after the retention wait and a final admin approval. This pack does not build the one-year clock. A staff account is not hidden by the member flow.
- Do not add an Access Level entity. Grants are `social.posts` and `social.reports` at view, edit, or manage. A ban is a Social `bannedAt`, not a Core role change and not an account delete.
- Points, badges, support tickets, chat, the notification bell, and live video are other packs. Social does not store them.
- Hero airsoft fields go in `extensions` jsonb, not new columns on `sf_social_*`.

## Uniqueness

Create the unique key in the slice that creates the table. A second insert updates the open row or is refused. Do not rely on a read-then-insert.

- Friendships: one row per pair.
- Reactions: one row per `(actorUserId, targetType, targetId)`.
- Challenge entry likes: one like per person per challenge, moved in a transaction.
- Reports: one open row per reporter per post.
- Follows: one row per pair.
- Poll votes: one row per `(postId, userId)`.
- Activity cards: one row per `(sourceModule, sourceId, activityKind)`.
- Story views: one row per `(userId, storyId)`.
- Page likes: one row per `(userId, pageId)`.

## Slices

1. **Shell.** Manifest, `schema.ts`, public door that returns immediately when Social is off, admin settings stub. Test the off door. `check:atomic`.
2. **Friends.** Request, accept, decline, cancel, unfriend, block. Tests: second accept, request after block, unfriend.
3. **Posts.** Text posts, four audiences, `canViewPost`, permalink not-found, reserved handles. Tests: only me, group and non-member, friends, public, block, hidden author.
4. **Feed.** Home feed, text composer, member route, `social-friends` particle, nav links Social and People. Test: empty post refused.
5. **Media.** `MediaPicker` on a post. Many images or one video. Test: unknown `mediaId` refused.
6. **Like.** One row, kind `like` only. Test: a second kind is refused.
7. **People.** `/feed/people` and `product:social/friend.requested`. Omit hidden and blocked people. A mail failure does not roll back the request.
8. **Comments.** One reply deep, edit, author delete, staff hide.
9. **Reports.** `postId` required. Test: a report with no post is refused.
10. **Account doors.** `exportOwnSocialRecord`, `hideOwnedSocialContent`, `purgeOwnSocialRecord` through `loadModuleDoor`. Tests: hide keeps the rows, and the member action does not call purge. Core retention is a different chat.
11. **Activity.** `publishActivity` on the Social door. Events and Pages callers are their own chats. A Social failure does not fail their publish.
12. **Challenge.** `endsAt` caps accept and upload. A 48-hour window needs a length of at least 2 days. Likes are on entries only, one per person, entrants cannot like. No share. Sweep `social.challenge.sweep`. Second invitee needs `hasEntitlement(userId, 'social.challenge.multi')`, refused with a link to `/plans` when false. Mail failure does not roll back the invite.
13. **Groups.** Categories `general`, `team`, `association`. Membership, wall posts, directory `/feed/groups` and `/feed/g/[slug]`, invite mail, `social-groups`. Test: a non-member fails `canViewPost`.
14. **Team tools.** Ranks, documents through Media, announcements (`product:social/group.announced`), Forms `formDefinitionId`. Test: a rank cannot remove the owner or an admin. Only the owner deletes or transfers the group. Events `hostModule`, `hostKind`, `hostId` is an Events chat, not this one.
15. **Pages.** `sf_social_pages`, admins, likes, page posts, `verifiedAt`, `/feed/pages` and `/feed/p/[slug]`, optional `sitePageId`, `social-pages`. Test: a non-liker cannot view a page post. Page-hosted events use `hostKind = page` in the Events chat.
16. **Stories.** 24 hours, seen and unseen, author viewer list, sweep hides the row and keeps the media file, `/feed/stories`, `social-stories`. Test: an expired story is hidden.
17. **Albums.** Member, group, and page. Files stay in Media.
18. **Share and links.** Test: a private address is refused, a challenge cannot be shared, a share omits a target `canViewPost` denies.
19. **Follow.** `sf_social_follows` and a Following tab of public posts.
20. **Mentions, tags, saves.** `/feed/tag/[tag]` uses `canViewPost`. `/feed/saved`.
21. **Polls, then check-in.** Closed poll cannot be edited. Check-in saves the label when Maps is off.
22. **Discover, reaction catalog, short-video layout.** Split into separate chats if they do not fit in one.
23. **Later packs, one chat each, only when that pack exists.** `recordAction` to Gamification (`social.post.created`, `social.comment.created`, `social.reaction.created`, `social.story.created`, `social.challenge.completed`). Search index. Notifications trigger list. Chat story replies.

## First chat

Slice 1 only. Do not add tables beyond what the shell needs to boot, and do not add posts or friends.

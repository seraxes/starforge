# product:social

Member social feed under `/feed`. Live video stays `product:stream`. Do not reuse the builtin particle id `social` (footer links).

## Shipped

- **Slice 1 shell** — manifest, public door (`api` / `api.server`) that returns immediately when Social is off, admin settings stub at `/admin/social`.
- **Slice 2 friends** — `sf_social_friendships` (one row per unordered pair), request / accept / decline / cancel / unfriend / block.
- **Slice 3 posts** — `sf_social_posts` text posts, audiences `only_me` | `group` | `friends` (default) | `public`, `canViewPost`, permalink not-found, reserved handles.
- **Slice 4 feed** — home friends feed, text composer (empty body refused), member route `/feed/[handle]` (+ `/feed/u/[handle]` for reserved words), `social-friends` particle, nav views Social + People.
- **Composer stage (first pass)** — the home composer is the feed card. A quiet strip grows in place. Instruments are photo, link, vote, and place, each gated by its pack switch. One block at a time; a second block asks before it replaces the first. The client submits only that block. Challenge and the Watch chip are later.
- **Slice 5 media** — `MediaPicker` / member picker on the composer; `sf_social_post_media` binds (`mediaId` stays in Media). Many images (≤10) or one video, not both. Unknown `mediaId`, non-owned media, 11 images, and image+video are refused.
- **Slice 6 like** — `canInteract` write gate (block / hidden / bannedAt); `sf_social_reactions` unique `(actorUserId, targetType, targetId)`. Not the challenge vote table.
- **Slice 7 people** — `/feed/people` directory (omit hidden + blocked), People nav, dual blockers (`blockedBy` + `blockedByOther`), `product:social/friend.requested` (mail failure does not roll back the request). `/feed/requests` redirects to People.
- **Slice 7b feed query** — home feed SQL predicate matching `canViewPost` (audience / friendship / block / hidden author), then LIMIT. No over-fetch + drop (that shortens a page).
- **Slice 8 comments** — `sf_social_comments` one reply deep; author edit/delete of own post or comment; parent-comment delete removes its reply; post delete cascades comments + likes in one transaction; staff hide of a post (`social.posts` manage). A reply to a reply is refused.
- **Slice 9 reports** — `sf_social_reports` with required `postId`, optional `commentId`; reason `spam` | `harassment` | `other`; one open row per reporter per post (second flag updates). A report with no post is refused. Stories / groups / pages have no Report control.
- **Slice 9b moderation** — review queue at `/admin/social/reports`; hide/restore post or comment; resolve report (`hidden` | `dismissed`); `sf_social_members.bannedAt` feeds `canInteract`. A banned member cannot post, comment, challenge, or send requests.
- **Slice 10 account doors** — `exportOwnSocialRecord`, `hideOwnedSocialContent`, `purgeOwnSocialRecord` on `social-api-server` (`loadModuleDoor`). Hide sets `sf_social_members.hiddenAt` and keeps rows. Purge is Core retention only. Every `sf_social_*` table is in the account registry (export / hide / purge).
- **Slice 11 activity** — `publishActivity` on the Social door. Unique `(sourceModule, sourceId, activityKind)`; republish updates. Linked post kind `activity`. Off → no write. Never throws so a Social failure does not fail Events / Pages publish (those callers are their own chats).
- **Slice 12 challenge** — `sf_social_challenges` / `sf_social_challenge_entries` / `sf_social_challenge_likes`. `endsAt` = `publishedAt` + `lengthDays` × 24h; 48h accept window needs `lengthDays` ≥ 2. Deadlines = `min(phase end, endsAt)`. Entrants cannot like; likes unique `(actorUserId, challengeId)`. No share. Second+ invite needs `social.challenge.multi` (Subscriptions off → refuse, no `/plans`; on without entitlement → `/plans`). Mail soft-fail. Job `social.sweep` (challenge handler; stories in slice 16).
- **Slice 13 groups** — categories `general` | `team` | `association`, membership, wall posts, directory `/feed/groups` and `/feed/g/[slug]`, invite mail `product:social/group.invited`, particle `social-groups`.
- **Slice 14 team tools** — ranks (`sf_social_group_ranks`), documents via Media (`sf_social_group_documents`), announcements (`isAnnouncement` + `product:social/group.announced`), Forms `formDefinitionId`. A rank cannot remove the owner or an admin. Only the owner deletes or transfers. Calendar hosting lives on Events (`hostModule` / `hostKind` / `hostId`); Social only lists and links create through `@/modules/events/api`.
- **Slice 15 pages** — `sf_social_pages` / `sf_social_page_admins` / `sf_social_page_likes` (unique `(userId, pageId)`), page wall posts, `verifiedAt`, optional `sitePageId`, directory `/feed/pages` and `/feed/p/[slug]`, particle `social-pages`. A non-liker cannot view a page post. Page-hosted events use Events `hostKind = page` (no Social calendar pack).
- **Slice 15b pack settings** — `/admin/social` Pack panel, one document in `sf_module_settings` (id `product:social`). Composer and feed: default audience, guest public read, feed page size, switches (text / media / link / share / poll / check-in / challenge / mentions / hashtags / comments / discover / following / short-video), comment length limit, hold-for-review (default off). Activity cards stay on this panel. Story lifetime, albums, images-per-post, and challenge windows moved to Media (15e). Unknown audience is refused. A disabled post kind cannot be created (`disabled_kind`). Social off leaves a disabled notice. Mail links to Email Manager; this screen does not edit templates.
- **Slice 15c people / reactions / reports** — `/admin/social/people`. Friend requests on/off + pending cap, friend-list visibility, follow on/off, ban/unban list, reaction kinds (+ comments/stories toggles), report reasons, auto-hide after N open reports, staff-hidden posts (hide/restore), word list. Unban clears `bannedAt`. A disabled reaction kind is refused (`disabled_kind`). Composer save merges and does not wipe these fields.
- **Slice 15d groups / pages admin** — `/admin/social/groups` and `/admin/social/pages`. Groups: on/off, who can create (`members` | `staff`), approval, default join rule, max members (0 = no cap), categories (name/slug/kind `general`|`team`|`association`), verified list, switches for documents / announcements / join form. Pages: on/off, who can create, approval, verified list + site-page id, likes on/off. A category kind outside the three is refused (`invalid_kind`). Composer/people saves merge and do not wipe these fields.
- **Slice 15e stories / albums / media / challenge admin** — `/admin/social/media`. Stories on/off + lifetime hours (default 24, range 1–48). Albums on/off + max items. Max images per post (default 10) + video on/off (image+video stays refused). Challenge on/off, 24h/48h windows, min/max length days, premium invite cap. A story lifetime outside 1–48 hours is refused (`invalid_story_lifetime`). Other admin saves merge and do not wipe these fields.
- **Slice 16 stories** — `sf_social_stories` (24h, `expiresAt`), `sf_social_story_views` (unique `(userId, storyId)`), seen/unseen tray, author viewer list (`canInteract` omits blocked), story expiry on the same `social.sweep` job (media file stays), `/feed/stories`, particle `social-stories`. An expired story is hidden.
- **Slice 17 albums** — `sf_social_albums` (`ownerType` `user` | `group` | `page`, `ownerId`, optional `coverMediaId`) and `sf_social_album_items` (unique `(albumId, mediaId)`). Files stay in Media. Member / group / page surfaces list albums. An unknown `mediaId` is refused.
- **Slice 18 share and links** — share posts (`sharedPostId`) and link posts (preview snapshot). Private addresses refused; challenges cannot be shared; share omits a target `canViewPost` denies; share refused when `canInteract` is false.
- **Slice 19 follow** — `sf_social_follows` (unique `(followerUserId, followeeUserId)`), Following tab of public posts at `/feed/following`, Follow on member profiles. A follow after a block is refused.
- **Slice 20 mentions, tags, saves** — `@handle` mentions (Profiles resolve; `canInteract` gates notify — blocked members are not notified), hashtags (`sf_social_post_tags`) at `/feed/tag/[tag]`, saves (`sf_social_saves`, unique `(userId, postId)`) at `/feed/saved`. Both tag and saved feeds use `canViewPost`. Saving a post the viewer cannot see is refused.
- **Slice 21 polls + check-in** — poll posts (`pollOptions` / `pollClosedAt`) + `sf_social_poll_votes` (unique `(postId, userId)`); check-in label with optional Maps pin (Maps door failure still saves the label).
- **Slice 22 discover** — `/feed/discover` lists personal public posts (`canViewPost` still applies). Friends-only posts are absent. Reserved handle `discover`.
- **Slice 22 reaction catalog** — kinds `like` | `love` | `haha` | `wow` | `sad` | `angry`. Enabled set is the pack settings document (`like` stays on). A disabled kind is refused (`disabled_kind`). Switching to another enabled kind updates the same unique row.
- **Slice 22 short-video layout** — layout modes `timeline` | `short_video` on the same media posts (not a fifth particle). `/feed/watch` fullscreen stack of single-video posts; reserved handle `watch`. A text or image-only post is absent. Blocked authors omitted via `canViewPost`.
- **Events calendar tab** — group/page Wall | Calendar tabs when `product:events` is on. Lists and Create link via `loadModuleDoor('events-api')` → `@/modules/events/api` (`hostModule = product:social`). No static advanced→advanced import. Editor stays `/admin/events`. When Events is off, the calendar tab is hidden.

## Owns

- Feed, friends, follows, mentions, hashtags, saves, posts, groups (including team/association ranks, documents, announcements), pages (admins, likes, wall), stories (24h + views), albums (member / group / page media binds), reactions, reports, activity cards, challenges, and Social-specific bans (`bannedAt`).
- Friendship graph (`sf_social_friendships`): unique `(pairLow, pairHigh)`; statuses `pending` | `accepted` | `declined` | `blocked`. Block uses `blockedBy` + `blockedByOther`; only a recorded blocker clears their own side.
- Posts (`sf_social_posts`): `canViewPost` is the only post read check. Hero extras stay in `extensions` jsonb. Author edit/delete; staff hide via `staffHidden`. Create refuses when the author is banned. Kind `activity` is system-published only.
- Post media binds (`sf_social_post_media`): role `attachment` (challenge_entry later). Files stay in `product:media`.
- Reactions (`sf_social_reactions`): catalog kinds `like` | `love` | `haha` | `wow` | `sad` | `angry`. Enabled kinds come from pack settings; `like` cannot be turned off. Unique `(actorUserId, targetType, targetId)`. `canInteract` is the write check.
- Comments (`sf_social_comments`): one reply deep (`parentCommentId` only on top-level). Create calls `canInteract` + `canViewPost`. Staff hide via `staffHidden`.
- Reports (`sf_social_reports`): always `postId`; optional `commentId` on that post. Create requires `canViewPost`. Resolve closes the open row. Post delete keeps report rows.
- Activities (`sf_social_activities`): cross-pack cards via `publishActivity`; unique `(sourceModule, sourceId, activityKind)`. Snapshot is the fallback when the source is gone.
- Challenges (`sf_social_challenges`, `sf_social_challenge_entries`, `sf_social_challenge_likes`): contest clocks, invites, entry likes (not reactions), `social.sweep` lock/outcome. Entitlement key `social.challenge.multi` lives on Subscriptions.
- Stories (`sf_social_stories`, `sf_social_story_views`): 24h media; unique view per `(userId, storyId)`; author viewer list filters with `canInteract`. Sweep sets `expiredAt`; Media file stays.
- Albums (`sf_social_albums`, `sf_social_album_items`): named collections on a member, group, or page; unique item per `(albumId, mediaId)`; files stay in Media. Member album view calls `canInteract`.
- Follows (`sf_social_follows`): directed edge; unique `(followerUserId, followeeUserId)`; `canInteract` gates follow. Following tab lists public posts from followees.
- Mentions (`sf_social_mentions`): unique `(postId, mentionedUserId)`; notify via `canInteract` (blocked → no notify). Hashtags (`sf_social_post_tags`): unique `(postId, tag)`; `/feed/tag/[tag]`. Saves (`sf_social_saves`): unique `(userId, postId)`; `/feed/saved`. Tag and saved lists call `canViewPost`.
- Members (`sf_social_members`): one row per userId; `bannedAt` is the Social ban (not a Core role); `hiddenAt` is account hide (rows kept until Core purge).
- Account doors: export / hide / purge registry covering every `sf_social_*` table.
- Home feed selection (SQL visibility predicate + paginate), Following tab, Discover tab (public posts only), Watch short-video layout (single-video posts), Saved, tag feeds, the personal stage composer (one live card; photo, link, vote, or place), and the People directory.
- Process boot arms `social.sweep` only when Social is enabled (challenges + story expiry on that one job).

## Consumes

- **profiles** — persona resolve / directory; plain text user ids only
- **media** — MediaPicker / assets
- **rich-editor** — post body sanitize / display
- **forms** — intake where needed
- **email-manager** — `emitEmailTrigger` only (never `getMailer()`); `product:social/friend.requested`, `product:social/group.invited`, `product:social/group.announced`
- **payments** — money flows that Social may start later
- **maps** — check-in labels
- **subscriptions** / **events** — optional (`optionalRequires`); challenge multi-invite reads `social.challenge.multi` via Core `resolveMemberAudience` when Subscriptions is on (no advanced→advanced import)

## Public door

```ts
import {
  canInteract,
  canViewPost,
  isEmptyPostBody,
  isPeopleDirectoryCandidate,
  isReservedFeedHandle,
  isSocialBanned,
  memberFeedHref,
  runSocialDoor,
  SOCIAL_FRIEND_REQUESTED_TRIGGER,
  SOCIAL_MODULE_ID,
} from '@/modules/social/api'
import {
  banMember,
  createComment,
  createPost,
  createReport,
  deletePost,
  exportOwnSocialRecord,
  findPost,
  getPostPermalink,
  hideOwnedSocialContent,
  isSocialModuleEnabled,
  likePost,
  listHomeFeedPosts,
  listOpenReports,
  listPeopleDirectory,
  createChallenge,
  inviteToChallengeNotifying,
  publishActivity,
  purgeOwnSocialRecord,
  requestFriendshipNotifying,
  resolveReport,
  setCommentStaffHidden,
  setPostStaffHidden,
  unblockUser,
  withSocialEnabled,
} from '@/modules/social/api.server'
```


Off → `runSocialDoor` / `withSocialEnabled` return `{ ok: false, reason: 'disabled' }` and do not run work.

Friends: one row per pair. Decline can be re-requested (upsert). Block refuses a later request until both blocker columns are cleared. Each side records its own block in `blockedBy` / `blockedByOther` and can clear only its own. Cancel / unfriend delete the row (unfriend of a blocked pair is refused).

Posts: `canViewPost(viewer, post)` gates every read. Permalink returns `not_found` when the check fails. Reserved handles (`people`, `groups`, …) link at `/feed/u/[handle]`. Empty composer body is refused (`empty_body`) unless media is attached. Unknown or non-owned `mediaId` → `unknown_media`. Image+video or 11 images → `invalid_media_mix`. Bytes stay on `/api/media/[id]` (no Social file route).

Reactions: `canInteract(a, b)` gates writes (block, hidden, Social `bannedAt`). A reaction requires `canViewPost` and `canInteract` with the author. Kind must be enabled in pack settings (`like` by default; `like` cannot be turned off). Unknown → `invalid_kind`; disabled → `disabled_kind`. Denied view → `cannot_view`. One row per `(actorUserId, targetType, targetId)`; switching kinds updates that row.

People: directory omits hidden and blocked members. Friend request emits `product:social/friend.requested`; a mail failure does not roll back the request. A banned member’s request is refused (`banned`).

Home feed: SQL WHERE matches `canViewPost` for the audiences the feed already queries, then paginates. Parity lives in `feed-query.test.ts`. Later audiences extend the predicate and that test.

Comments: one reply deep. Create requires `canViewPost` and `canInteract` with the post author. A reply to a reply → `reply_too_deep`. Author edit/delete own comment; deleting a parent also deletes its reply. Author edit/delete own post; post delete removes comments and likes in one transaction. Staff hide sets `staffHidden` on a post or comment (`cannot_manage` without `social.posts` manage).

Reports: every row has `postId` (optional `commentId` on that post). Create requires `canViewPost`. Empty / missing / unknown post → `no_post`. One open row per `(reporterUserId, postId)`; a second flag updates that row. Reasons: `spam` | `harassment` | `other`. Review queue `/admin/social/reports` resolves to `hidden` (also staff-hides content) or `dismissed`. Post delete keeps reports.

Bans: `sf_social_members.bannedAt` — not a Core role change. A banned member’s post is refused (`banned`). `canInteract` fails for post, comment, challenge, and request while either side is banned.

Account doors (via `loadModuleDoor('social-api-server')`): `exportOwnSocialRecord` for download; `hideOwnedSocialContent` sets `hiddenAt` and keeps rows (staff accounts refused); `purgeOwnSocialRecord` deletes rows when Core asks after retention. The member hide path never calls purge. A registry lists every `sf_social_*` table with export / hide / purge handlers.

Activity: `publishActivity({ sourceModule, sourceId, actorUserId, activityKind, snapshot })` upserts one card. Off → `disabled` and no write. Pack switches for `event.published` and `page.published` default on; a switch that is off returns `disabled` and does not write. Errors return `failed` without throwing so Events / Pages publish is not rolled back. Readers re-resolve title / href / media through the owner door; snapshot is the fallback.

Pack settings (`sf_module_settings`, id `product:social`): `/admin/social` (composer/feed), `/admin/social/people` (people/reactions/reports), `/admin/social/groups`, and `/admin/social/pages`. Default post audience feeds the home composer. Guest public read, feed page size, comment length, hold-for-review, and composer/feature switches gate create and tabs. A disabled post kind is refused (`disabled_kind`). Story lifetime hours feed new stories (default 24). Multi-challenge cap limits invites for a member with `social.challenge.multi` (default 10; over the cap → `invite_cap`). Friend-list visibility is `friends` or `only_me`. Friend requests and follow have pack switches; pending requests can be capped. Reaction kinds are toggled on the people page (`like` stays on; disabled → `disabled_kind`). Report reasons are a catalog subset; auto-hide staff-hides a post after N open reports (0 = off). Blocked words refuse post/comment create (`blocked_word`). Groups/pages: feature switches, creator role, approval (unverified until staff verifies when on), default join rule, member cap, category kinds `general`|`team`|`association` (other → `invalid_kind`), page likes switch. An unknown audience is refused (`invalid_audience`). Social off shows a disabled notice and does not open the editor.

Challenges: `endsAt` = `publishedAt` + `lengthDays` × 24h. Accept window 24|48 must fit in length (48h + `lengthDays` 1 → `invalid_timing`). Accept/upload deadlines = `min(phase end, endsAt)`. First invite always; second+ needs `social.challenge.multi` when Subscriptions is on (link `/plans` when missing); Subscriptions off refuses second invite with no plans link. Pack multi-challenge cap (default 10) refuses a further invite with `invite_cap`. `product:social/challenge.invited` soft-fails. Likes: `sf_social_challenge_likes` unique `(actorUserId, challengeId)`; entrants cannot like; moving a like updates the row. Challenge posts are not shareable. `social.sweep` expires overdue invites/uploads and locks past `endsAt`.

Stories: `expiresAt` = `createdAt` + pack story lifetime (default 24h). Listing hides when expired (clock or `expiredAt`). Views unique `(userId, storyId)` (seen/unseen). Author viewer list omits blocked / hidden / banned via `canInteract`. `social.sweep` marks `expiredAt`; the Media file stays. Directory `/feed/stories`; particle `social-stories`.

Follows: one row per `(followerUserId, followeeUserId)`. Create calls `canInteract` (block → `blocked`). Following tab `/feed/following` shows public posts from followees (`canViewPost` still applies). Reserved handle `following`.

Discover: `/feed/discover` lists personal public posts (SQL audience=`public`, then LIMIT). Friends-only posts are absent even when the viewer is friends with the author. Blocked / hidden / staff-hidden authors are omitted via `canViewPost`. Reserved handle `discover`.

Short-video layout: modes `timeline` (default) and `short_video` on the same media posts — not a second module and not one of the four particles. `/feed/watch` lists home-feed-visible posts that have exactly one `video/*` bind. Text and image-only posts are absent. `canViewPost` still applies. Reserved handle `watch`. Unknown layout mode → `invalid_layout`.

Mentions / tags / saves: `@handle` resolved through Profiles; notify skips when `canInteract` is false (blocked → no notify). Hashtags from the body → `sf_social_post_tags`; `/feed/tag/[tag]` uses `canViewPost`. Save requires `canViewPost` (`cannot_view` when denied); unique `(userId, postId)`. `/feed/saved` omits posts the viewer may no longer see. Reserved handles `saved` and `tag`.

Particle: `social-friends` (not builtin `social`) lists accepted friends and links to `/feed/requests` (redirects to People).

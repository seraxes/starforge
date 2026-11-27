# product:social

Layer: advanced

Status: built-default-off (`defaultEnabled: false`; in scope to finish — [2026-11-22-social-built-parked](../../../docs/project-context/docs/decisions/2026-11-22-social-built-parked.md); not parked)

Member social feed under `/feed`. Live video belongs to this pack. There is no `product:stream` ([2026-11-26-chat-shop-stream](../../../docs/project-context/docs/decisions/2026-11-26-chat-shop-stream.md)). Do not reuse the builtin particle id `social` (footer links).

Requires: `product:profiles`, `product:media`, `product:rich-editor`, `product:forms`, `product:email-manager`. `optionalRequires`: `form`, `product:subscriptions`, `product:events`.

## Owns

### Shipped slices 1–22

- **Slice 1 shell** — manifest, public door (`api` / `api.server`) that returns immediately when Social is off, admin settings stub at `/admin/social`.
- **Slice 2 friends** — `sf_social_friendships` (one row per unordered pair), request / accept / decline / cancel / unfriend / block.
- **Slice 3 posts** — `sf_social_posts` text posts, audiences `only_me` | `group` | `friends` (default) | `public`, `canViewPost`, permalink not-found, reserved handles.
- **Slice 4 feed** — home friends feed, text composer (empty body refused), member route `/feed/[handle]` (+ `/feed/u/[handle]` for reserved words), `social-friends` particle, nav views Social + People.
- **Composer stage (first pass)** — the home composer is the feed card. A quiet strip grows in place. Instruments are photo, link, vote, and place, each gated by its pack switch. One block at a time; a second block asks before it replaces the first. The client submits only that block. Challenge and the Watch chip are later.
- **Slice 5 media** — `MediaPicker` / member picker on the composer; `sf_social_post_media` binds (`mediaId` stays in Media). Many images (≤10) or one video, not both. Unknown `mediaId`, non-owned media, 11 images, and image+video are refused.
- **Slice 6 like** — `canInteract` write gate (block / hidden / bannedAt); `sf_social_reactions` unique `(actorUserId, targetType, targetId)`. Not the challenge vote table. The feed Like control sets `like`, and clicking that same reaction again clears the row. Another enabled kind updates the one row.
- **Slice 7 people** — `/feed/people` directory (omit hidden + blocked), People nav, dual blockers (`blockedBy` + `blockedByOther`), `product:social/friend.requested` (mail failure does not roll back the request). `/feed/requests` redirects to People.
- **Slice 7b feed query** — home feed SQL predicate matching `canViewPost` (audience / friendship / block / hidden author), then LIMIT. No over-fetch + drop (that shortens a page).
- **Slice 8 comments** — `sf_social_comments` with replies to any comment. Visually two steps: replies sit one step under the top comment; a reply to a reply stays on that step and names who it answers. The comment author may edit or delete their own. The post author may delete any comment on that post. Social staff with `admin.social` edit may edit/delete any comment. Deleting a comment removes the replies under it. Post delete cascades comments + likes in one transaction; staff hide of a post (`social.posts` manage). The feed card shows the latest comments, with earlier ones behind “view earlier”. Share is a note opened from the post’s Share action, not a comment.
- **Feed reactions** — one Like control on the post. A click sets Like. A second click on that reaction clears it. Hover, keyboard focus, or a touch hold opens the other enabled kinds (`love` / `haha` / `wow` / `sad` / `angry` when on). The summary line counts each kind. Comment and Share sit on that same action row. A comment uses the same control when Reactions on comments is on.
- **Feed image box** — Admin → Social → Media sets max width and max height in pixels. A taller photo is cut at the center.
- **Slice 9 reports** — `sf_social_reports` with required `postId`, optional `commentId`; reason `spam` | `harassment` | `other`; one open row per reporter per post (second flag updates). A report with no post is refused. Stories / groups / pages have no Report control.
- **Slice 9b moderation** — review queue at `/admin/social/reports`; hide/restore post or comment; resolve report (`hidden` | `dismissed`); `sf_social_members.bannedAt` feeds `canInteract`. A banned member cannot post, comment, challenge, or send requests.
- **Slice 10 account doors** — `exportOwnSocialRecord`, `hideOwnedSocialContent`, `purgeOwnSocialRecord` on `social-api-server` (`loadModuleDoor`). Hide sets `sf_social_members.hiddenAt` and keeps rows. Purge is Core retention only. Every `sf_social_*` table is in the account registry (export / hide / purge).
- **Slice 11 activity** — `publishActivity` on the Social door. Unique `(sourceModule, sourceId, activityKind)`; republish updates. Linked post kind `activity`. Off → no write. Never throws so a Social failure does not fail Events / Pages publish (those callers are their own chats).
- **Slice 12 challenge** — `sf_social_challenges` / `sf_social_challenge_entries` / `sf_social_challenge_likes`. `endsAt` = `publishedAt` + `lengthDays` × 24h; 48h accept window needs `lengthDays` ≥ 2. Deadlines = `min(phase end, endsAt)`. Entrants cannot like; likes unique `(actorUserId, challengeId)`. No share. Second+ invite needs `social.challenge.multi` (Subscriptions off → refuse, no `/plans`; on without entitlement → `/plans`). Mail soft-fail. Job `social.sweep` (challenge handler; stories in slice 16).
- **Slice 13 groups** — categories `general` | `team` | `association`, membership, wall posts, directory `/feed/groups` and `/feed/g/[slug]`, invite mail `product:social/group.invited`, particle `social-groups`. Closed groups create `requested` rows; owner / admin / manage-members rank (and Social staff) approve or decline on the group page. Decline clears the row so the member can ask again. Open joins stay instant. Approve respects `maxGroupMembers`; a banned actor cannot approve.
- **Slice 14 team tools** — ranks (`sf_social_group_ranks`), documents via Media (`sf_social_group_documents`), announcements (`isAnnouncement` + `product:social/group.announced`), Forms `formDefinitionId`. A rank cannot remove the owner or an admin. Only the owner deletes or transfers. Calendar hosting lives on Events (`hostModule` / `hostKind` / `hostId`); Social only lists and links create through `@/modules/events/api`.
- **Slice 15 pages** — `sf_social_pages` / `sf_social_page_admins` / `sf_social_page_likes` (unique `(userId, pageId)`), page wall posts, `verifiedAt`, optional `sitePageId`, directory `/feed/pages` and `/feed/p/[slug]`, particle `social-pages`. A non-liker cannot view a page post. Page-hosted events use Events `hostKind = page` (no Social calendar pack).
- **Slice 15b pack settings** — `/admin/social` Pack panel, one document in `sf_module_settings` (id `product:social`). Composer and feed: default audience, guest public read, feed page size, switches (text / media / link / share / poll / check-in / challenge / mentions / hashtags / comments / discover / following / short-video), comment length limit, member write rate limit (max + window seconds; Core `getRateLimiter()`), hold-for-review (default off). Activity cards stay on this panel. Story lifetime, albums, images-per-post, and challenge windows moved to Media (15e). Unknown audience is refused. A disabled post kind cannot be created (`disabled_kind`). Social off leaves a disabled notice. Mail links to Email Manager; this screen does not edit templates.
- **Slice 15c people / reactions / reports** — `/admin/social/people`. Friend requests on/off + pending cap, friend-list visibility, follow on/off, ban/unban list, reaction kinds (+ comments/stories toggles), report reasons, auto-hide after N open reports, staff-hidden posts (hide/restore), word list. Unban clears `bannedAt`. A disabled reaction kind is refused (`disabled_kind`). Composer save merges and does not wipe these fields.
- **Slice 15d groups / pages admin** — `/admin/social/groups` and `/admin/social/pages`. Groups: on/off, who can create (`members` | `staff`), approval, default join rule, max members (0 = no cap), categories (name/slug/kind `general`|`team`|`association`), verified list, switches for documents / announcements / join form. Pages: on/off, who can create, approval, verified list + site-page id, likes on/off. A category kind outside the three is refused (`invalid_kind`). Composer/people saves merge and do not wipe these fields.
- **Slice 15e stories / albums / media / challenge admin** — `/admin/social/media`. Stories on/off + lifetime hours (default 24, range 1–48). Albums on/off + max items. Max images per post (default 10) + video on/off (image+video stays refused). Challenge on/off, 24h/48h windows, min/max length days, premium invite cap. A story lifetime outside 1–48 hours is refused (`invalid_story_lifetime`). Other admin saves merge and do not wipe these fields.
- **Slice 16 stories** — `sf_social_stories` (24h, `expiresAt`), `sf_social_story_views` (unique `(userId, storyId)`), seen/unseen tray, author viewer list (`canInteract` omits blocked), story expiry on the same `social.sweep` job (media file stays), `/feed/stories`, particle `social-stories`. An expired story is hidden.
- **Slice 17 albums** — `sf_social_albums` (`ownerType` `user` | `group` | `page`, `ownerId`, optional `coverMediaId`) and `sf_social_album_items` (unique `(albumId, mediaId)`). Files stay in Media. Member / group / page surfaces list albums. An unknown `mediaId` is refused.
- **Slice 18 share and links** — share posts (`sharedPostId`) and link posts (preview snapshot). Private addresses refused; challenges cannot be shared; a share cannot use a wider audience than the original (`audience_too_wide`); sharing a share card points at the original; share omits a target `canViewPost` denies and the card says the content isn’t available; share refused when `canInteract` is false. Author ··· menu: Edit post / Delete post. App admins / developers / Social staff with `admin.social` edit get the same on any post.
- **Slice 19 follow** — `sf_social_follows` (unique `(followerUserId, followeeUserId)`), Following tab of public posts at `/feed/following`, Follow on member profiles. A follow after a block is refused.
- **Slice 20 mentions, tags, saves** — `@handle` mentions (Profiles resolve; `canInteract` gates notify — blocked members are not notified), hashtags (`sf_social_post_tags`) at `/feed/tag/[tag]`, saves (`sf_social_saves`, unique `(userId, postId)`) at `/feed/saved`. Both tag and saved feeds use `canViewPost`. Saving a post the viewer cannot see is refused.
- **Slice 21 polls + check-in** — poll posts (`pollOptions` / `pollClosedAt`) + `sf_social_poll_votes` (unique `(postId, userId)`); check-in label with optional Maps pin (Maps door failure still saves the label).
- **Slice 22 discover** — `/feed/discover` lists personal public posts (`canViewPost` still applies). Friends-only posts are absent. Reserved handle `discover`.
- **Slice 22 reaction catalog** — kinds `like` | `love` | `haha` | `wow` | `sad` | `angry`. Enabled set is the pack settings document (`like` stays on). A disabled kind is refused (`disabled_kind`). Switching to another enabled kind updates the same unique row.
- **Slice 22 short-video layout** — layout modes `timeline` | `short_video` on the same media posts (not a fifth particle). `/feed/watch` fullscreen stack of single-video posts; reserved handle `watch`. A text or image-only post is absent. Blocked authors omitted via `canViewPost`.
- **Events calendar tab** — group/page Wall | Calendar tabs when `product:events` is on. Lists and Create link via `loadModuleDoor('events-api')` → `@/modules/events/api` (`hostModule = product:social`). No static advanced→advanced import. Editor stays `/admin/events`. When Events is off, the calendar tab is hidden.

### Domain ownership

- Feed, friends, follows, mentions, hashtags, saves, posts, groups (including team/association ranks, documents, announcements), pages (admins, likes, wall), stories (24h + views), albums (member / group / page media binds), reactions, reports, activity cards, challenges, and Social-specific bans (`bannedAt`).
- **Comments engine + likes + reports** — platform owner for these. No `product:comments` or `product:reports`. A page or an event may turn on a conversation that uses this engine only when Social is installed and enabled (event conversation UI is later work). Decision: [2026-11-22-comments-reports-ownership](../../../docs/project-context/docs/decisions/2026-11-22-comments-reports-ownership.md).
- Friendship graph (`sf_social_friendships`): unique `(pairLow, pairHigh)`; statuses `pending` | `accepted` | `declined` | `blocked`. Block uses `blockedBy` + `blockedByOther`; only a recorded blocker clears their own side.
- Posts (`sf_social_posts`): `canViewPost` is the only post read check. Hero extras stay in `extensions` jsonb. Author edit/delete; staff hide via `staffHidden`. Create refuses when the author is banned. Kind `activity` is system-published only. Staff grant (`viewerMayModerateSocialContent` — app admin / `admin.social` edit) private-reads `only_me`, friends-only, and group posts without membership; block and author-hidden still deny.
- Post media binds (`sf_social_post_media`): role `attachment` (challenge_entry later). Files stay in `product:media`.
- Reactions (`sf_social_reactions`): catalog kinds `like` | `love` | `haha` | `wow` | `sad` | `angry`. Enabled kinds come from pack settings; `like` cannot be turned off. Per-kind chrome: `reactionIcons` (FA class), `reactionIconColors` (FA tint), optional `reactionIconMediaIds` (Media image replaces FA+color). `showReactionLabels` toggles words; `reactionIconSizePx` sizes tray-popup glyphs only; `reactionTrayHoverSizePx` + `reactionTrayHoverEasing` control the tray-choice hover grow. FA classes render when `product:font-awesome` is on; images always can. Unique `(actorUserId, targetType, targetId)`. `canInteract` is the write check. Soft consume of site FA chrome (class names only — Social does not hard-require the FA pack).
- Comments (`sf_social_comments`): reply to any comment. The card draws every reply one step under the top comment and names who a nested reply answers. Create calls `canInteract` + `canViewPost`. The comment author may edit or delete their own. The post author may delete any comment on that post. Staff with `admin.social` edit may edit or delete any. Staff hide via `staffHidden`. Deleting a comment deletes the replies under it.
- Reports (`sf_social_reports`): always `postId`; optional `commentId` on that post. Create requires `canViewPost`. Resolve closes the open row. Post delete keeps report rows. Stay in Social — not a shared reports pack.
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
- **form** (particle, `optionalRequires`) — layout Form particle pack (`src/modules/form`); keep-or-drop of this edge is still open on the live map — do not remove the manifest line in docs-only slices
- **subscriptions** / **events** — optional (`optionalRequires`); challenge multi-invite reads `social.challenge.multi` via Core `resolveMemberAudience` when Subscriptions is on (no advanced→advanced import); Events calendar tab via `loadModuleDoor('events-api')`
- Check-in place labels use Core `getMapProvider()` (geocode); Social does **not** hard-require or call `product:maps` (TacMap / tactical event map). Payments is **not** a Social dependency — do not add a Social cart ([2026-11-22-social-dependency-floor](../../../docs/project-context/docs/decisions/2026-11-22-social-dependency-floor.md)).

## Public door

Doors: `social-api` → `@/modules/social/api`; `social-api-server` → `@/modules/social/api.server`.

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

Posts: `canViewPost(viewer, post)` gates every read. Permalink returns `not_found` when the check fails. Staff with the Social moderate grant may read another member’s `only_me`, friends-only, and non-member group posts (same grant as edit/delete). Reserved handles (`people`, `groups`, …) link at `/feed/u/[handle]`. Empty composer body is refused (`empty_body`) unless media is attached. Unknown or non-owned `mediaId` → `unknown_media`. Image+video or 11 images → `invalid_media_mix`. Attaching (or widening a post) to an audience wider than the file’s current level → `audience_too_wide`. Bytes stay on `/api/media/[id]` / `/api/media/file/[...key]`; those app routes call `decideSocialMediaServeAccess` (`canViewBoundMedia` / `canViewPost`) before redirect or bytes — serve context passes the real staff grant so a file URL follows the post. Unbound or public-narrowest stays public; friends-only / only_me / group / album / story / group-document binds 404 for strangers and never redirect to a public CDN.

Reactions: `canInteract(a, b)` gates writes (block, hidden, Social `bannedAt`). A reaction requires `canViewPost` and `canInteract` with the author. Kind must be enabled in pack settings (`like` by default; `like` cannot be turned off). Admin sets per kind: FA class (`reactionIcons`, empty → default), FA color (`reactionIconColors`), optional Media image (`reactionIconMediaIds` — image wins over class/color). `showReactionLabels` (default on). `reactionIconSizePx` (12–40, default 16) applies only to the hover/hold tray popup. `reactionTrayHoverSizePx` (12–64, default 28) and `reactionTrayHoverEasing` (`ease` | `ease-in` | `ease-out` | `ease-in-out` | `linear`, default `ease`) control how tray choices grow on hover. FA glyphs need site Font Awesome; custom images do not. Unknown → `invalid_kind`; disabled → `disabled_kind`. Denied view → `cannot_view`. One row per `(actorUserId, targetType, targetId)`; switching kinds updates that row. Clearing the active reaction deletes it. Sending the same kind again without a clear still noops.

People: directory omits hidden and blocked members. Friend request emits `product:social/friend.requested`; a mail failure does not roll back the request. A banned member’s request is refused (`banned`).

Groups: open join → `active` immediately. Closed join → `requested`; the group page lists pending requests for owner / admin / a rank with `canManageMembers`, and for app admins / `admin.social` edit (staff bypass is additive). Approve → `active` (respects `maxGroupMembers` → `member_cap`). Decline deletes the row so they can ask again. A banned actor cannot approve or decline (`banned`). Member-facing copy lives in `messages/` (`product:social`).

Home feed: SQL WHERE matches `canViewPost` (including staff private-read when the grant is set), then paginates. Parity lives in `feed-query.test.ts`. Later audiences extend the predicate and that test.

Comments: reply to any comment; the UI keeps two visual steps. Create requires `canViewPost` and `canInteract` with the post author. The comment author may edit or delete their own. The post author may delete any comment on that post. Social staff with `admin.social` edit may edit or delete any comment (`not_author` without one of those gates). Deleting a comment also deletes replies under it, including nested replies. Author edit/delete own post; app admins / developers / Social staff with `admin.social` edit may edit, delete, or change audience on any post (`sf-staff-bypass`). Staff ··· menus stay additive (Hide / Block remain). Post delete removes comments and likes in one transaction. Staff hide sets `staffHidden` on a post or comment (`cannot_manage` without `social.posts` manage).

Reports: every row has `postId` (optional `commentId` on that post). Create requires `canViewPost`. Empty / missing / unknown post → `no_post`. One open row per `(reporterUserId, postId)`; a second flag updates that row. Reasons: `spam` | `harassment` | `other`. Review queue `/admin/social/reports` resolves to `hidden` (also staff-hides content) or `dismissed`. Post delete keeps reports.

Bans: `sf_social_members.bannedAt` — not a Core role change. A banned member’s post is refused (`banned`). `canInteract` fails for post, comment, challenge, and request while either side is banned.

Account doors (via `loadModuleDoor('social-api-server')`): `exportOwnSocialRecord` for download; `hideOwnedSocialContent` sets `hiddenAt` and keeps rows (staff accounts refused); `purgeOwnSocialRecord` deletes rows when Core asks after retention. The member hide path never calls purge. A registry lists every `sf_social_*` table with export / hide / purge handlers.

Activity: `publishActivity({ sourceModule, sourceId, actorUserId, activityKind, snapshot })` upserts one card. Off → `disabled` and no write. Pack switches for `event.published` and `page.published` default on; a switch that is off returns `disabled` and does not write. Errors return `failed` without throwing so Events / Pages publish is not rolled back. Readers re-resolve title / href / media through the owner door; snapshot is the fallback.

Pack settings (`sf_module_settings`, id `product:social`): `/admin/social` (composer/feed), `/admin/social/people` (people/reactions/reports), `/admin/social/groups`, and `/admin/social/pages`. Default post audience feeds the home composer. Guest public read, feed page size, comment length, member write rate limit (`writeRateLimitMax` / `writeRateLimitWindowSec`, default 60 / 60s via Core `getRateLimiter()` — key `social-write:${userId}:${clientIp}`; staff not exempt; admin saves / ban / staff-hide / report resolve skip the bucket), hold-for-review, and composer/feature switches gate create and tabs. A disabled post kind is refused (`disabled_kind`). Story lifetime hours feed new stories (default 24). Multi-challenge cap limits invites for a member with `social.challenge.multi` (default 10; over the cap → `invite_cap`). Friend-list visibility is `friends` or `only_me`. Friend requests and follow have pack switches; pending requests can be capped. Reaction kinds are toggled on the people page (`like` stays on; disabled → `disabled_kind`). Report reasons are a catalog subset; auto-hide staff-hides a post after N open reports (0 = off). Blocked words refuse post/comment create (`blocked_word`). Groups/pages: feature switches, creator role, approval (unverified until staff verifies when on), default join rule, member cap, category kinds `general`|`team`|`association` (other → `invalid_kind`), page likes switch. An unknown audience is refused (`invalid_audience`). Social off shows a disabled notice and does not open the editor.

Challenges: `endsAt` = `publishedAt` + `lengthDays` × 24h. Accept window 24|48 must fit in length (48h + `lengthDays` 1 → `invalid_timing`). Accept/upload deadlines = `min(phase end, endsAt)`. First invite always; second+ needs `social.challenge.multi` when Subscriptions is on (link `/plans` when missing); Subscriptions off refuses second invite with no plans link. Pack multi-challenge cap (default 10) refuses a further invite with `invite_cap`. `product:social/challenge.invited` soft-fails. Likes: `sf_social_challenge_likes` unique `(actorUserId, challengeId)`; entrants cannot like; moving a like updates the row. Challenge posts are not shareable. `social.sweep` expires overdue invites/uploads and locks past `endsAt`.

Stories: `expiresAt` = `createdAt` + pack story lifetime (default 24h). Listing hides when expired (clock or `expiredAt`). Views unique `(userId, storyId)` (seen/unseen). Author viewer list omits blocked / hidden / banned via `canInteract`. `social.sweep` marks `expiredAt`; the Media file stays. Directory `/feed/stories`; particle `social-stories`.

Follows: one row per `(followerUserId, followeeUserId)`. Create calls `canInteract` (block → `blocked`). Following tab `/feed/following` shows public posts from followees (`canViewPost` still applies). Reserved handle `following`.

Discover: `/feed/discover` lists personal public posts (SQL audience=`public`, then LIMIT). Friends-only posts are absent even when the viewer is friends with the author. Blocked / hidden / staff-hidden authors are omitted via `canViewPost`. Reserved handle `discover`.

Short-video layout: modes `timeline` (default) and `short_video` on the same media posts — not a second module and not one of the four particles. `/feed/watch` lists home-feed-visible posts that have exactly one `video/*` bind. Text and image-only posts are absent. `canViewPost` still applies. Reserved handle `watch`. Unknown layout mode → `invalid_layout`.

Mentions / tags / saves: `@handle` resolved through Profiles; notify skips when `canInteract` is false (blocked → no notify). Hashtags from the body → `sf_social_post_tags`; `/feed/tag/[tag]` uses `canViewPost`. Save requires `canViewPost` (`cannot_view` when denied); unique `(userId, postId)`. `/feed/saved` omits posts the viewer may no longer see. Reserved handles `saved` and `tag`.

Particles (not builtin `social` footer links). Allowlist in `starforge.modules.json`; place from Layouts under the active Skin outline:

| Id | Layout | Scope |
| --- | --- | --- |
| `social-friends` | Friends list + requests link | Logged-in viewer |
| `social-groups` | Cover + small owner avatar under it; title on one line | `viewer` (memberships) / `groups` (ids) / `all` — cover images on/off |
| `social-pages` | Same card layout as groups | `viewer` (liked) / `groups` (page ids) / `all` — cover images on/off |
| `social-albums` | Image-only tiles (cover or first item) | `viewer` / `groups` (group albums) / `all` visible albums |
| `social-stories` | Stories tray | (existing) |

## Admin surfaces

- `/admin/social`, `/admin/social/settings`, `/admin/social/people`, `/admin/social/groups`, `/admin/social/pages`, `/admin/social/media`, `/admin/social/reports`
- ACL area `social` (`admin.social`)
- Public feed routes under `/[locale]/feed` (home, people, groups, pages, stories, following, discover, watch, saved, tag, member handles, post permalink)

## Boot and jobs

`bootSocial` (generated `runModuleBoot`) when Social is enabled: `ensureSocialSweep` registers job `social.sweep` (challenge overdue invites/uploads/lock + story `expiredAt`). Returns immediately when Social is off — sweep is not armed.

## Known gaps

- Enablement blockers on the live map before flipping `defaultEnabled` to on for launch sites (see [social-module-standing](../../../docs/project-context/docs/social-module-standing.md))
- Event conversation UI on public event detail (Social comments engine when Social is on)
- Composer **Challenge** and **Watch** chips (stage first pass ships photo, link, vote, place only)
- Report control on stories / groups / pages (posts and comments only today)
- Post media role `challenge_entry` (attachment role reserved)

## Tests

`src/modules/social/door.test.ts`, `friends.test.ts`, `posts.test.ts`, `feed.test.ts`, `feed-query.test.ts`, `media.test.ts`, `media-serve.test.ts`, `reactions.test.ts`, `people.test.ts`, `comments.test.ts`, `reports.test.ts`, `moderation.test.ts`, `account.test.ts`, `activity.test.ts`, `challenge.test.ts`, `groups.test.ts`, `group-tools.test.ts`, `pages.test.ts`, `stories.test.ts`, `albums.test.ts`, `share-links.test.ts`, `follows.test.ts`, `mentions-tags-saves.test.ts`, `polls-checkin.test.ts`, `discover.test.ts`, `reaction-catalog.test.ts`, `short-video.test.ts`, `pack-settings.test.ts`, `composer-feed-settings.test.ts`, `stage.test.ts`, `people-reactions-reports-settings.test.ts`, `groups-pages-settings.test.ts`, `media-admin-settings.test.ts`, `rate-limit.test.ts`, `boot.test.ts` (all in `test:unit`)
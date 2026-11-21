import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:social — member feed, friends, groups, pages, stories.
 * Slice 4: home feed, text composer, member route, social-friends particle, Social + People nav.
 * Slice 5: MediaPicker attachments on posts (many images or one video).
 * Slice 6: post likes (canInteract + sf_social_reactions).
 * Slice 7: People directory, dual blockers, friend.requested mail.
 * Slice 8: comments (two reply levels), author edit/delete, staff hide, post cascade.
 * Slice 9: reports (postId required, optional commentId; one open per reporter/post).
 * Slice 9b: moderation review queue, comment hide, resolve report, member bannedAt.
 * Slice 10: account doors exportOwnSocialRecord / hideOwnedSocialContent / purgeOwnSocialRecord.
 * Slice 11: publishActivity (sf_social_activities; Events/Pages callers are separate chats).
 * Slice 12: challenges (endsAt / multi invite / challenge likes), social.sweep.
 * Slice 13: groups (categories, membership, wall, directory, invite mail, social-groups).
 * Slice 14: team tools (ranks, documents, announcements, formDefinitionId).
 * Slice 15: pages (admins, likes, wall, directory, verifiedAt, sitePageId, social-pages).
 * Slice 15b: pack admin composer/feed settings in sf_module_settings (audience, guest read, page size, kind/feature switches, comment length, hold-for-review; plus existing friend list / story / challenge cap / activity / reactions).
 * Slice 15c: /admin/social/people — friend requests, follow, bans/unban, reaction toggles, report reasons, auto-hide, staff-hidden posts, word list.
 * Slice 15d: /admin/social/groups + /admin/social/pages — creation rules, categories, verified lists, group/page feature switches.
 * Slice 15e: /admin/social/media — stories lifetime (1–48h), album cap, images-per-post, video toggle, challenge windows / length / invite cap.
 * Slice 16: stories (24h, seen/unseen, viewer list), story expiry on social.sweep, social-stories.
 * Slice 17: albums (member / group / page); mediaId binds; files stay in Media.
 * Slice 18: share posts (sharedPostId) + link posts (preview; private addresses refused).
 * Slice 19: follows (sf_social_follows) + Following tab of public posts.
 * Slice 20: mentions, hashtags (/feed/tag/[tag]), saves (/feed/saved).
 * Slice 21: polls (sf_social_poll_votes) + check-in (label; Maps pin optional).
 * Slice 22 discover: /feed/discover public posts (friends-only absent); reserved handle discover.
 * Slice 22 reaction catalog: like|love|haha|wow|sad|angry; like stays on; other kinds follow pack settings (15c people panel).
 * Slice 22 short-video: layout mode short_video; /feed/watch; reserved handle watch; non-video absent.
 * Do not reuse the builtin particle id `social` (footer links).
 */
export default defineStarforgeModule({
  id: 'product:social',
  kind: 'product',
  layer: 'advanced',
  label: 'Social',
  description:
    'Member social feed — friends, follows, discover, short-video watch, mentions, tags, saves, polls, check-ins, posts, groups, pages, stories, albums, shares, and links under /feed. Live video stays product:stream.',
  version: '0.1.0',
  defaultEnabled: false,
  requires: [
    'product:profiles',
    'product:media',
    'product:rich-editor',
    'product:forms',
    'product:email-manager',
    'product:payments',
    'product:maps',
  ],
  optionalRequires: ['form', 'product:subscriptions', 'product:events'],
  boot: {
    importPath: '@/modules/social/boot',
    exportName: 'bootSocial',
  },
  navViews: [
    { key: 'feed', label: 'Social', href: '/feed' },
    { key: 'people', label: 'People', href: '/feed/people' },
    { key: 'groups', label: 'Groups', href: '/feed/groups' },
    { key: 'pages', label: 'Pages', href: '/feed/pages' },
    { key: 'stories', label: 'Stories', href: '/feed/stories' },
    { key: 'following', label: 'Following', href: '/feed/following' },
    { key: 'discover', label: 'Discover', href: '/feed/discover' },
    { key: 'watch', label: 'Watch', href: '/feed/watch' },
    { key: 'saved', label: 'Saved', href: '/feed/saved' },
    { key: 'admin', label: 'Social', href: '/admin/social' },
    { key: 'settings', label: 'Social settings', href: '/admin/social' },
  ],
  admin: {
    navGroup: {
      id: 'social',
      label: 'Social',
      href: '/admin/social',
      expandable: true,
      order: 54,
    },
    nav: [
      {
        group: 'social',
        label: 'Settings',
        href: '/admin/social',
        order: 10,
        area: 'social',
        exact: true,
      },
      {
        group: 'social',
        label: 'People',
        href: '/admin/social/people',
        order: 15,
        area: 'social',
      },
      {
        group: 'social',
        label: 'Groups',
        href: '/admin/social/groups',
        order: 16,
        area: 'social',
      },
      {
        group: 'social',
        label: 'Pages',
        href: '/admin/social/pages',
        order: 17,
        area: 'social',
      },
      {
        group: 'social',
        label: 'Media',
        href: '/admin/social/media',
        order: 18,
        area: 'social',
      },
      {
        group: 'social',
        label: 'Reports',
        href: '/admin/social/reports',
        order: 20,
        area: 'social',
      },
    ],
    areas: [{ key: 'social', label: 'Social' }],
    routes: [
      {
        path: 'social',
        pageImportPath: '@/modules/social/admin/SocialSettingsPage',
        pageExportName: 'default',
      },
      {
        path: 'social/settings',
        pageImportPath: '@/modules/social/admin/SocialSettingsPage',
        pageExportName: 'default',
      },
      {
        path: 'social/people',
        pageImportPath: '@/modules/social/admin/SocialPeopleSettingsPage',
        pageExportName: 'default',
      },
      {
        path: 'social/groups',
        pageImportPath: '@/modules/social/admin/SocialGroupsSettingsPage',
        pageExportName: 'default',
      },
      {
        path: 'social/pages',
        pageImportPath: '@/modules/social/admin/SocialPagesSettingsPage',
        pageExportName: 'default',
      },
      {
        path: 'social/media',
        pageImportPath: '@/modules/social/admin/SocialMediaSettingsPage',
        pageExportName: 'default',
      },
      {
        path: 'social/reports',
        pageImportPath: '@/modules/social/admin/SocialReportsPage',
        pageExportName: 'default',
      },
    ],
  },
  publicRoutes: [
    {
      path: 'feed',
      pageImportPath: '@/modules/social/public/SocialHomeFeedPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'feed/people',
      pageImportPath: '@/modules/social/public/SocialPeoplePage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'feed/groups',
      pageImportPath: '@/modules/social/public/SocialGroupsPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'feed/g/[slug]',
      pageImportPath: '@/modules/social/public/SocialGroupPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'feed/pages',
      pageImportPath: '@/modules/social/public/SocialPagesPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'feed/p/[slug]',
      pageImportPath: '@/modules/social/public/SocialPagePage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'feed/stories',
      pageImportPath: '@/modules/social/public/SocialStoriesPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'feed/following',
      pageImportPath: '@/modules/social/public/SocialFollowingPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'feed/discover',
      pageImportPath: '@/modules/social/public/SocialDiscoverPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'feed/watch',
      pageImportPath: '@/modules/social/public/SocialShortVideoPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'feed/saved',
      pageImportPath: '@/modules/social/public/SocialSavedPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'feed/tag/[tag]',
      pageImportPath: '@/modules/social/public/SocialTagFeedPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'feed/requests',
      pageImportPath: '@/modules/social/public/SocialRequestsStubPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'feed/post/[id]',
      pageImportPath: '@/modules/social/public/SocialPostPermalinkPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'feed/u/[handle]',
      pageImportPath: '@/modules/social/public/SocialMemberFeedReservedPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'feed/[handle]',
      pageImportPath: '@/modules/social/public/SocialMemberFeedPage',
      reexport: ['generateMetadata'],
    },
  ],
  doors: [
    { id: 'social-api', importPath: '@/modules/social/api' },
    { id: 'social-api-server', importPath: '@/modules/social/api.server' },
  ],
  db: { schema: 'src/modules/social/schema.ts' },
})

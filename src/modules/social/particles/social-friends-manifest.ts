import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * social-friends particle — requires product:social.
 * Do not reuse the builtin particle id `social` (footer links).
 */
export default defineStarforgeModule({
  id: 'social-friends',
  kind: 'particle',
  layer: 'advanced',
  label: 'Social friends',
  description:
    'Accepted friends list with a requests link. Needs product:social. Links to /feed and /feed/people.',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/social/particles/social-friends-module',
  exportName: 'socialFriendsModule',
  requires: ['product:social'],
  navViews: [
    { key: 'feed', label: 'Social', href: '/feed' },
    { key: 'people', label: 'People', href: '/feed/people' },
  ],
  editorImportPath: '@/modules/social/admin/social-particle-editors',
  editorExportName: 'SocialFriendsParticleEditor',
})

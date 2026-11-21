import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * social-groups particle — requires product:social.
 * Do not reuse the builtin particle id `social` (footer links).
 */
export default defineStarforgeModule({
  id: 'social-groups',
  kind: 'particle',
  layer: 'advanced',
  label: 'Social groups',
  description:
    'Groups you belong to. Needs product:social. Links to /feed/groups and /feed/g/[slug].',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/social/particles/social-groups-module',
  exportName: 'socialGroupsModule',
  requires: ['product:social'],
  navViews: [
    { key: 'feed', label: 'Social', href: '/feed' },
    { key: 'groups', label: 'Groups', href: '/feed/groups' },
  ],
  editorImportPath: '@/modules/social/admin/social-particle-editors',
  editorExportName: 'SocialGroupsParticleEditor',
})

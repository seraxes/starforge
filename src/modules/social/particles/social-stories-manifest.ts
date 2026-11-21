import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * social-stories particle — requires product:social.
 * Do not reuse the builtin particle id `social` (footer links).
 */
export default defineStarforgeModule({
  id: 'social-stories',
  kind: 'particle',
  layer: 'advanced',
  label: 'Social stories',
  description:
    'Active stories tray. Needs product:social. Links to /feed/stories.',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/social/particles/social-stories-module',
  exportName: 'socialStoriesModule',
  requires: ['product:social'],
  navViews: [
    { key: 'feed', label: 'Social', href: '/feed' },
    { key: 'stories', label: 'Stories', href: '/feed/stories' },
  ],
  editorImportPath: '@/modules/social/admin/social-particle-editors',
  editorExportName: 'SocialStoriesParticleEditor',
})

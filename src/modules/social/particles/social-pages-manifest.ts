import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * social-pages particle — requires product:social.
 * Do not reuse the builtin particle id `social` (footer links).
 */
export default defineStarforgeModule({
  id: 'social-pages',
  kind: 'particle',
  layer: 'advanced',
  label: 'Social pages',
  description:
    'Pages list with cover + avatar. Scope: logged-in user (liked), selected page ids, or all. Needs product:social.',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/social/particles/social-pages-module',
  exportName: 'socialPagesModule',
  requires: ['product:social'],
  navViews: [
    { key: 'feed', label: 'Social', href: '/feed' },
    { key: 'pages', label: 'Pages', href: '/feed/pages' },
  ],
  editorImportPath: '@/modules/social/admin/social-particle-editors',
  editorExportName: 'SocialPagesParticleEditor',
})

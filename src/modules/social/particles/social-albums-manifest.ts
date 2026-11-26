import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * social-albums particle — requires product:social.
 * Image-only tiles from member / group / recent albums.
 */
export default defineStarforgeModule({
  id: 'social-albums',
  kind: 'particle',
  layer: 'advanced',
  label: 'Social albums',
  description:
    'Album cover images from product:social. Scope: logged-in user, selected groups, or all visible. Image only.',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/social/particles/social-albums-module',
  exportName: 'socialAlbumsModule',
  requires: ['product:social'],
  navViews: [
    { key: 'feed', label: 'Social', href: '/feed' },
  ],
  editorImportPath: '@/modules/social/admin/social-particle-editors',
  editorExportName: 'SocialAlbumsParticleEditor',
})

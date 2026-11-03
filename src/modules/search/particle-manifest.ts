import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * Search particle pack entry — allowlisted via dynamic import of `searchModule`.
 */
export default defineStarforgeModule({
  id: 'search',
  kind: 'particle',
  label: 'Search',
  description:
    'Public search box → /search over published Payload pages (title / slug / meta). Needs product:search.',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/search',
  exportName: 'searchModule',
  requires: ['product:search'],
  navViews: [{ key: 'search', label: 'Search', href: '/search' }],
})

import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:search — public /search over published Payload pages.
 * Engine lives in `src/core/content/search*`; this manifest owns catalog meta.
 */
export default defineStarforgeModule({
  id: 'product:search',
  kind: 'product',
  label: 'Search',
  description:
    'Public /search over published Payload pages (title / slug / meta). Search particle for layouts. No Algolia — Payload/Postgres contains.',
  version: '0.1.0',
  defaultEnabled: true,
  navViews: [{ key: 'search', label: 'Search', href: '/search' }],
})

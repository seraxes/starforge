import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:redirects — URL redirects admin + Node proxy lookup.
 * Engine still in `src/core/redirects` until M3; manifest owns catalog/nav metadata.
 */
export default defineStarforgeModule({
  id: 'product:redirects',
  kind: 'product',
  label: 'Redirects',
  description:
    'URL redirects (from → to + status) with Node proxy lookup. Sitemap of published pages stays at /sitemap.xml.',
  version: '0.1.0',
  defaultEnabled: true,
  navViews: [{ key: 'admin', label: 'Redirects', href: '/admin/redirects' }],
  admin: {
    navGroup: {
      id: 'redirects',
      label: 'Redirects',
      order: 50,
    },
    nav: [
      {
        group: 'redirects',
        label: 'Redirects',
        href: '/admin/redirects',
        order: 10,
        area: 'redirects',
      },
    ],
    areas: [{ key: 'redirects', label: 'Redirects' }],
  },
  db: { schema: 'src/core/db/schema.ts' },
})

import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:redirects — URL redirects admin + middleware lookup.
 * Engine still in `src/core/redirects` until M3; manifest owns catalog/nav metadata.
 */
export default defineStarforgeModule({
  id: 'product:redirects',
  kind: 'product',
  label: 'Redirects',
  description:
    'URL redirects (from → to + status) with middleware lookup. Sitemap of published pages stays at /sitemap.xml.',
  version: '0.1.0',
  defaultEnabled: true,
  navViews: [{ key: 'admin', label: 'Redirects', href: '/app/admin/redirects' }],
  admin: {
    nav: [
      {
        group: 'Content',
        label: 'Redirects',
        href: '/app/admin/redirects',
        order: 50,
        area: 'redirects',
      },
    ],
    areas: [{ key: 'redirects', label: 'Redirects' }],
  },
  db: { schema: 'src/core/db/schema.ts' },
})

import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:redirects — URL redirects admin + Node proxy lookup.
 * Engine, `sf_redirects`, and the proxy hook live in this pack (M3).
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
  proxy: {
    order: 10,
    handlerImportPath: '@/modules/redirects/proxy',
    handlerExportName: 'handleRedirectProxy',
  },
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
    routes: [
      {
        path: 'redirects',
        pageImportPath: '@/modules/redirects/admin/RedirectsPage',
        pageExportName: 'default',
      },
    ],
  },
  db: { schema: 'src/modules/redirects/schema.ts' },
})

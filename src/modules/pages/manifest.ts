import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:pages — editorial pages behind PageReadsPort.
 * Not Core. Not a base engine other packs require.
 */
export default defineStarforgeModule({
  id: 'product:pages',
  kind: 'product',
  layer: 'site',
  label: 'Pages',
  description:
    'Brochure pages with draft, published, and unpublished, created and published dates, creator and publisher, TipTap body, SEO, page categories, and page tags. Public reads go through PageReadsPort.',
  version: '0.1.0',
  defaultEnabled: true,
  requires: ['product:rich-editor', 'product:media'],
  optionalRequires: ['product:social'],
  i18n: {
    namespaces: ['product:pages'],
  },
  navViews: [
    { key: 'admin', label: 'Pages', href: '/admin/pages' },
    { key: 'categories', label: 'Categories', href: '/admin/pages/categories' },
  ],
  doors: [{ id: 'pages-api', importPath: '@/modules/pages/api.server' }],
  admin: {
    navGroup: {
      id: 'pages',
      label: 'Pages',
      href: '/admin/pages',
      order: 44,
    },
    nav: [
      {
        group: 'pages',
        label: 'Pages',
        href: '/admin/pages',
        order: 10,
        area: 'pages',
        exact: true,
      },
      {
        group: 'pages',
        label: 'Categories',
        href: '/admin/pages/categories',
        order: 20,
        area: 'pages',
      },
    ],
    areas: [{ key: 'pages', label: 'Pages' }],
    routes: [
      {
        path: 'pages',
        pageImportPath: '@/modules/pages/admin/PagesListPage',
        pageExportName: 'default',
      },
      {
        path: 'pages/categories',
        pageImportPath: '@/modules/pages/admin/PagesCategoriesPage',
        pageExportName: 'default',
      },
      {
        path: 'pages/new',
        pageImportPath: '@/modules/pages/admin/PagesNewPage',
        pageExportName: 'default',
      },
      {
        path: 'pages/[pageId]',
        pageImportPath: '@/modules/pages/admin/PagesEditPage',
        pageExportName: 'default',
      },
    ],
  },
  db: { schema: 'src/modules/pages/schema.ts' },
})

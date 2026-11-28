import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:marketplace — slice 10: Social feed share.
 * Plan: docs/project-context/docs/marketplace-build-spec.md
 */
export default defineStarforgeModule({
  id: 'product:marketplace',
  kind: 'product',
  layer: 'advanced',
  label: 'Marketplace',
  description:
    'Classifieds / marketplace. Categories, listings, settings, staff moderation, public loop, optional listing fee, and Social feed share.',
  version: '0.1.0',
  defaultEnabled: true,
  i18n: {
    namespaces: ['product:marketplace'],
  },
  requires: [
    'product:payments',
    'product:profiles',
    'product:media',
    'product:email-manager',
  ],
  optionalRequires: ['product:social', 'product:subscriptions'],
  boot: {
    importPath: '@/modules/marketplace/boot',
    exportName: 'bootMarketplace',
  },
  navViews: [
    { key: 'public', label: 'Marketplace', href: '/marketplace' },
    { key: 'sell', label: 'Sell', href: '/marketplace/new' },
    { key: 'you', label: 'Your listings', href: '/marketplace/you' },
    { key: 'admin', label: 'Marketplace', href: '/admin/marketplace' },
    { key: 'categories', label: 'Categories', href: '/admin/marketplace' },
    { key: 'listings', label: 'Listings', href: '/admin/marketplace/listings' },
    { key: 'settings', label: 'Settings', href: '/admin/marketplace/settings' },
  ],
  admin: {
    navGroup: {
      id: 'marketplace',
      label: 'Marketplace',
      href: '/admin/marketplace',
      expandable: true,
      order: 55,
    },
    nav: [
      {
        group: 'marketplace',
        label: 'Categories',
        href: '/admin/marketplace',
        order: 10,
        area: 'marketplace',
        exact: true,
      },
      {
        group: 'marketplace',
        label: 'Listings',
        href: '/admin/marketplace/listings',
        order: 20,
        area: 'marketplace',
      },
      {
        group: 'marketplace',
        label: 'Settings',
        href: '/admin/marketplace/settings',
        order: 30,
        area: 'marketplace',
      },
    ],
    areas: [{ key: 'marketplace', label: 'Marketplace' }],
    routes: [
      {
        path: 'marketplace',
        pageImportPath: '@/modules/marketplace/admin/MarketplaceCategoriesPage',
        pageExportName: 'default',
      },
      {
        path: 'marketplace/listings',
        pageImportPath: '@/modules/marketplace/admin/MarketplaceListingsPage',
        pageExportName: 'default',
      },
      {
        path: 'marketplace/listings/[id]',
        pageImportPath: '@/modules/marketplace/admin/MarketplaceListingEditPage',
        pageExportName: 'default',
      },
      {
        path: 'marketplace/settings',
        pageImportPath: '@/modules/marketplace/admin/MarketplaceSettingsPage',
        pageExportName: 'default',
      },
    ],
    dashboard: [
      {
        id: 'marketplace.listings',
        title: 'Marketplace',
        order: 80,
        size: 'md',
        widgetImportPath: '@/modules/marketplace/dashboard/MarketplaceListingsWidget',
        widgetExportName: 'MarketplaceListingsWidget',
        statsImportPath: '@/modules/marketplace/dashboard/marketplace-stats',
        statsExportName: 'loadMarketplaceListingsStats',
      },
    ],
  },
  doors: [
    { id: 'marketplace-api', importPath: '@/modules/marketplace/api' },
    { id: 'marketplace-api-server', importPath: '@/modules/marketplace/api.server' },
  ],
  publicRoutes: [
    {
      path: 'marketplace',
      pageImportPath: '@/modules/marketplace/public/MarketplaceBrowsePage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'marketplace/new',
      pageImportPath: '@/modules/marketplace/public/MarketplaceNewPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'marketplace/you',
      pageImportPath: '@/modules/marketplace/public/MarketplaceYouPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'marketplace/[id]',
      pageImportPath: '@/modules/marketplace/public/MarketplaceDetailPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'marketplace/[id]/edit',
      pageImportPath: '@/modules/marketplace/public/MarketplaceEditPage',
      reexport: ['generateMetadata'],
    },
  ],
  db: { schema: 'src/modules/marketplace/schema.ts' },
})

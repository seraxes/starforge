import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:ads — packages, credits, placements, campaigns.
 * Slice 2: catalog schema + /admin/ads. No Payments bridge / Social publish yet.
 * Plan: docs/project-context/docs/ads-pack-plan.md
 */
export default defineStarforgeModule({
  id: 'product:ads',
  kind: 'product',
  layer: 'advanced',
  label: 'Ads',
  description:
    'Ad packages, credits, placements, and campaigns. Payments moves money; Social owns the feed surface. Default off until cutover turns it on.',
  version: '0.1.0',
  defaultEnabled: false,
  requires: [
    'product:social',
    'product:email-manager',
    'product:forms',
    'product:subscriptions',
    'product:payments',
  ],
  optionalRequires: ['product:media'],
  navViews: [
    { key: 'admin', label: 'Ads', href: '/admin/ads' },
    { key: 'packages', label: 'Packages', href: '/admin/ads' },
    { key: 'placements', label: 'Placements', href: '/admin/ads/placements' },
    { key: 'campaigns', label: 'Campaigns', href: '/admin/ads/campaigns' },
  ],
  admin: {
    navGroup: {
      id: 'ads',
      label: 'Ads',
      href: '/admin/ads',
      expandable: true,
      order: 48,
    },
    nav: [
      {
        group: 'ads',
        label: 'Packages',
        href: '/admin/ads',
        order: 10,
        area: 'ads',
        exact: true,
      },
      {
        group: 'ads',
        label: 'Placements',
        href: '/admin/ads/placements',
        order: 20,
        area: 'ads',
      },
      {
        group: 'ads',
        label: 'Campaigns',
        href: '/admin/ads/campaigns',
        order: 30,
        area: 'ads',
      },
    ],
    areas: [{ key: 'ads', label: 'Ads' }],
    routes: [
      {
        path: 'ads',
        pageImportPath: '@/modules/ads/admin/AdsPackagesPage',
        pageExportName: 'default',
      },
      {
        path: 'ads/placements',
        pageImportPath: '@/modules/ads/admin/AdsPlacementsPage',
        pageExportName: 'default',
      },
      {
        path: 'ads/campaigns',
        pageImportPath: '@/modules/ads/admin/AdsCampaignsPage',
        pageExportName: 'default',
      },
    ],
  },
  doors: [
    { id: 'ads-api', importPath: '@/modules/ads/api' },
    { id: 'ads-api-server', importPath: '@/modules/ads/api.server' },
  ],
  db: { schema: 'src/modules/ads/schema.ts' },
})

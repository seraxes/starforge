import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:marketplace — thin stub pack (Dashboard listings glance).
 * Full Marketplace/piactér lands later; this row hosts a soft Coming soon card.
 */
export default defineStarforgeModule({
  id: 'product:marketplace',
  kind: 'product',
  label: 'Marketplace',
  description:
    'Classifieds / marketplace listings (upcoming). Soft Dashboard stub until the Marketplace pack ships.',
  version: '0.0.1',
  defaultEnabled: true,
  navViews: [{ key: 'admin', label: 'Marketplace (upcoming)', href: '/admin/settings' }],
  admin: {
    areas: [{ key: 'marketplace', label: 'Marketplace' }],
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
})

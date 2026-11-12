import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:subscriptions — plans, periods, entitlements.
 * Payments charges + snapshots; this pack owns catalog and grants.
 */
export default defineStarforgeModule({
  id: 'product:subscriptions',
  kind: 'product',
  label: 'Subscriptions',
  description:
    'Plans and periods for player premium, organizer premium, and advertisements. Payments charges; this pack grants entitlements.',
  version: '0.1.0',
  defaultEnabled: true,
  requires: ['product:payments', 'product:email-manager'],
  i18n: {
    namespaces: ['product:subscriptions'],
  },
  navViews: [
    { key: 'admin', label: 'Subscriptions', href: '/admin/subscriptions' },
    { key: 'plans', label: 'Plans', href: '/admin/subscriptions' },
    { key: 'subscribers', label: 'Subscribers', href: '/admin/subscriptions/subscribers' },
  ],
  admin: {
    navGroup: {
      id: 'subscriptions',
      label: 'Subscriptions',
      href: '/admin/subscriptions',
      expandable: true,
      order: 47,
    },
    nav: [
      {
        group: 'subscriptions',
        label: 'Plans',
        href: '/admin/subscriptions',
        order: 10,
        area: 'subscriptions',
        exact: true,
      },
      {
        group: 'subscriptions',
        label: 'Subscribers',
        href: '/admin/subscriptions/subscribers',
        order: 20,
        area: 'subscriptions',
      },
    ],
    areas: [{ key: 'subscriptions', label: 'Subscriptions' }],
    routes: [
      {
        path: 'subscriptions',
        pageImportPath: '@/modules/subscriptions/admin/SubscriptionsPlansPage',
        pageExportName: 'default',
      },
      {
        path: 'subscriptions/subscribers',
        pageImportPath: '@/modules/subscriptions/admin/SubscriptionsSubscribersPage',
        pageExportName: 'default',
      },
    ],
  },
  db: { schema: 'src/modules/subscriptions/schema.ts' },
})

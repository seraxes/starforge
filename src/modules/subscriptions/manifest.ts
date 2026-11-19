import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:subscriptions — plans, periods, entitlements.
 * Payments charges + snapshots; this pack owns catalog and grants.
 */
export default defineStarforgeModule({
  id: 'product:subscriptions',
  kind: 'product',
  layer: 'advanced',
  label: 'Subscriptions',
  description:
    'Plans and periods for player premium, organizer premium, and advertisements. Payments charges; this pack grants entitlements.',
  version: '0.1.0',
  defaultEnabled: true,
  requires: ['product:payments', 'product:email-manager', 'product:forms', 'product:profiles'],
  optionalRequires: ['form', 'product:media'],
  boot: {
    importPath: '@/modules/subscriptions/boot',
    exportName: 'bootSubscriptions',
  },
  i18n: {
    namespaces: ['product:subscriptions'],
  },
  navViews: [
    { key: 'catalog', label: 'Plans', href: '/plans' },
    { key: 'account', label: 'My subscriptions', href: '/account/subscriptions' },
    { key: 'admin', label: 'Subscriptions', href: '/admin/subscriptions' },
    { key: 'plans', label: 'Admin plans', href: '/admin/subscriptions' },
    { key: 'subscribers', label: 'Subscribers', href: '/admin/subscriptions/subscribers' },
    { key: 'changes', label: 'Changes', href: '/admin/subscriptions/changes' },
    { key: 'settings', label: 'Settings', href: '/admin/subscriptions/settings' },
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
      {
        group: 'subscriptions',
        label: 'Changes',
        href: '/admin/subscriptions/changes',
        order: 25,
        area: 'subscriptions',
      },
      {
        group: 'subscriptions',
        label: 'Settings',
        href: '/admin/subscriptions/settings',
        order: 30,
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
      {
        path: 'subscriptions/changes',
        pageImportPath: '@/modules/subscriptions/admin/SubscriptionsUpgradesPage',
        pageExportName: 'default',
      },
      {
        path: 'subscriptions/settings',
        pageImportPath: '@/modules/subscriptions/admin/SubscriptionsSettingsPage',
        pageExportName: 'default',
      },
    ],
  },
  doors: [{ id: 'subscriptions-api', importPath: '@/modules/subscriptions/api' }],
  publicRoutes: [
    {
      path: 'plans',
      pageImportPath: '@/modules/subscriptions/public/SubscriptionsPublicPlansPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'account/subscriptions',
      pageImportPath: '@/modules/subscriptions/public/AccountSubscriptionsPage',
      reexport: ['metadata'],
    },
  ],
  db: { schema: 'src/modules/subscriptions/schema.ts' },
})

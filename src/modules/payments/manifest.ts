import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:payments — shared cart, checkout, orders, VAT invoices, gateway orchestration.
 * Consumers (Events, Shop, Subscriptions, Ads) call `@/modules/payments/api` only.
 * Email via Email Manager; gateways via Core `src/core/payments` port.
 */
export default defineStarforgeModule({
  id: 'product:payments',
  kind: 'product',
  label: 'Payments',
  description:
    'Shared commerce — cart, checkout, VAT-proof orders/invoices, offline + Barion/Stripe/PayPal. No per-module payment UIs; receipts via Email Manager.',
  version: '0.1.0',
  defaultEnabled: true,
  requires: ['product:email-manager'],
  i18n: {
    namespaces: ['product:payments'],
  },
  navViews: [
    { key: 'admin', label: 'Payments', href: '/admin/payments' },
    { key: 'orders', label: 'Orders', href: '/admin/payments/orders' },
    { key: 'invoices', label: 'Invoices', href: '/admin/payments/invoices' },
    { key: 'merchant', label: 'My merchant', href: '/admin/payments/merchant' },
    { key: 'settings', label: 'Payments settings', href: '/admin/payments/settings' },
  ],
  admin: {
    navGroup: {
      id: 'payments',
      label: 'Payments',
      href: '/admin/payments',
      expandable: true,
      order: 46,
    },
    nav: [
      {
        group: 'payments',
        label: 'Overview',
        href: '/admin/payments',
        order: 10,
        area: 'payments',
        exact: true,
      },
      {
        group: 'payments',
        label: 'Orders',
        href: '/admin/payments/orders',
        order: 20,
        area: 'payments',
      },
      {
        group: 'payments',
        label: 'Invoices',
        href: '/admin/payments/invoices',
        order: 30,
        area: 'payments',
      },
      {
        group: 'payments',
        label: 'My merchant',
        href: '/admin/payments/merchant',
        order: 35,
        area: 'payments-merchant',
      },
      {
        group: 'payments',
        label: 'Settings',
        href: '/admin/payments/settings',
        order: 40,
        area: 'payments',
      },
    ],
    areas: [
      { key: 'payments', label: 'Payments' },
      { key: 'payments-merchant', label: 'Payments merchant' },
    ],
    routes: [
      {
        path: 'payments',
        pageImportPath: '@/modules/payments/admin/PaymentsOverviewPage',
        pageExportName: 'default',
      },
      {
        path: 'payments/orders',
        pageImportPath: '@/modules/payments/admin/PaymentsOrdersPage',
        pageExportName: 'default',
      },
      {
        path: 'payments/orders/[orderId]',
        pageImportPath: '@/modules/payments/admin/PaymentsOrderDetailPage',
        pageExportName: 'default',
      },
      {
        path: 'payments/invoices',
        pageImportPath: '@/modules/payments/admin/PaymentsInvoicesPage',
        pageExportName: 'default',
      },
      {
        path: 'payments/settings',
        pageImportPath: '@/modules/payments/admin/PaymentsSettingsPage',
        pageExportName: 'default',
      },
      {
        path: 'payments/merchant',
        pageImportPath: '@/modules/payments/admin/PaymentsMerchantPage',
        pageExportName: 'default',
      },
    ],
  },
  db: { schema: 'src/modules/payments/schema.ts' },
})

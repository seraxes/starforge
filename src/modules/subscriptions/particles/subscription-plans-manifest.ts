import { defineStarforgeModule } from '@/core/modules/define-module'

/** subscription-plans particle — requires product:subscriptions. */
export default defineStarforgeModule({
  id: 'subscription-plans',
  kind: 'particle',
  layer: 'advanced',
  label: 'Subscription plans',
  description:
    'Public plan mosaic with subscribe CTA. Place on any layout. Needs product:subscriptions. Links to /plans.',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/subscriptions/particles/subscription-plans-module',
  exportName: 'subscriptionPlansModule',
  requires: ['product:subscriptions'],
  navViews: [{ key: 'plans', label: 'Plans', href: '/plans' }],
  editorImportPath: '@/modules/subscriptions/admin/subscriptions-particle-editors',
  editorExportName: 'SubscriptionPlansParticleEditor',
})

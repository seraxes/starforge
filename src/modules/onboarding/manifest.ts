import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:onboarding — slice 2: status builder + identity facts.
 * Events, notes, invite, training, and the workers table land in later slices.
 * `optionalRequires: product:fleet` waits until that manifest exists
 * (unknown optional ids fail modules:generate).
 * Plan: docs/project-context/docs/onboarding-build-spec.md
 */
export default defineStarforgeModule({
  id: 'product:onboarding',
  kind: 'product',
  layer: 'advanced',
  label: 'Onboarding',
  description:
    'Recruiting workflow from application until an active driver. Status builder and identity facts are in tree. Default off until a PrimeOne site turns it on.',
  version: '0.2.0',
  defaultEnabled: false,
  requires: [
    'product:forms',
    'product:media',
    'product:email-manager',
    'product:profiles',
  ],
  navViews: [
    { key: 'admin', label: 'Onboarding', href: '/admin/onboarding' },
    { key: 'statuses', label: 'Statuses', href: '/admin/onboarding' },
  ],
  admin: {
    navGroup: {
      id: 'onboarding',
      label: 'Onboarding',
      href: '/admin/onboarding',
      expandable: true,
      order: 56,
    },
    nav: [
      {
        group: 'onboarding',
        label: 'Statuses',
        href: '/admin/onboarding',
        order: 10,
        area: 'onboarding',
        exact: true,
      },
    ],
    areas: [{ key: 'onboarding', label: 'Onboarding' }],
    routes: [
      {
        path: 'onboarding',
        pageImportPath: '@/modules/onboarding/admin/OnboardingStatusesPage',
        pageExportName: 'default',
      },
    ],
  },
  doors: [
    { id: 'onboarding-api', importPath: '@/modules/onboarding/api' },
    { id: 'onboarding-api-server', importPath: '@/modules/onboarding/api.server' },
  ],
  db: { schema: 'src/modules/onboarding/schema.ts' },
})

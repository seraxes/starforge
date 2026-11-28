import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:onboarding — slice 6: Documents bridge for training PDF render.
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
    'Recruiting workflow from invite until an active driver. Driver-home particle shows status message, action chip, and dashboard tiles. Default off until a PrimeOne site turns it on.',
  version: '0.13.0',
  defaultEnabled: false,
  requires: [
    'product:forms',
    'product:media',
    'product:email-manager',
    'product:profiles',
  ],
  optionalRequires: ['product:documents'],
  navViews: [
    { key: 'apply', label: 'Apply', href: '/onboarding/apply' },
    { key: 'home', label: 'My onboarding', href: '/account/onboarding' },
    { key: 'admin', label: 'Onboarding', href: '/admin/onboarding' },
    { key: 'workers', label: 'People', href: '/admin/onboarding' },
    { key: 'statuses', label: 'Statuses', href: '/admin/onboarding/statuses' },
    { key: 'training', label: 'Training', href: '/admin/onboarding/training' },
    { key: 'settings', label: 'Settings', href: '/admin/onboarding/settings' },
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
        label: 'People',
        href: '/admin/onboarding',
        order: 10,
        area: 'onboarding',
        exact: true,
      },
      {
        group: 'onboarding',
        label: 'Statuses',
        href: '/admin/onboarding/statuses',
        order: 20,
        area: 'onboarding',
      },
      {
        group: 'onboarding',
        label: 'Training',
        href: '/admin/onboarding/training',
        order: 30,
        area: 'onboarding',
      },
      {
        group: 'onboarding',
        label: 'Settings',
        href: '/admin/onboarding/settings',
        order: 40,
        area: 'onboarding',
      },
    ],
    areas: [{ key: 'onboarding', label: 'Onboarding' }],
    routes: [
      {
        path: 'onboarding',
        pageImportPath: '@/modules/onboarding/admin/OnboardingWorkersPage',
        pageExportName: 'default',
      },
      {
        path: 'onboarding/statuses',
        pageImportPath: '@/modules/onboarding/admin/OnboardingStatusesPage',
        pageExportName: 'default',
      },
      {
        path: 'onboarding/training',
        pageImportPath: '@/modules/onboarding/admin/OnboardingTrainingPage',
        pageExportName: 'default',
      },
      {
        path: 'onboarding/settings',
        pageImportPath: '@/modules/onboarding/admin/OnboardingSettingsPage',
        pageExportName: 'default',
      },
      {
        path: 'onboarding/people/[userId]',
        pageImportPath: '@/modules/onboarding/admin/OnboardingPersonPage',
        pageExportName: 'default',
      },
    ],
  },
  doors: [
    { id: 'onboarding-api', importPath: '@/modules/onboarding/api' },
    { id: 'onboarding-api-server', importPath: '@/modules/onboarding/api.server' },
  ],
  publicRoutes: [
    {
      path: 'onboarding/apply',
      pageImportPath: '@/modules/onboarding/public/OnboardingApplyPage',
      reexport: ['generateMetadata'],
    },
    {
      path: 'account/onboarding',
      pageImportPath: '@/modules/onboarding/public/AccountOnboardingPage',
      reexport: ['metadata'],
    },
  ],
  db: { schema: 'src/modules/onboarding/schema.ts' },
})

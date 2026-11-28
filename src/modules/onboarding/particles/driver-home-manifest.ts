import { defineStarforgeModule } from '@/core/modules/define-module'

/** driver-home particle — requires product:onboarding. */
export default defineStarforgeModule({
  id: 'driver-home',
  kind: 'particle',
  layer: 'advanced',
  label: 'Driver home',
  description:
    'Signed-in person’s Onboarding status message, action chip, and dashboard tiles. Needs product:onboarding. Renders nothing when the pack is off or nobody is signed in.',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/onboarding/particles/driver-home-module',
  exportName: 'driverHomeModule',
  requires: ['product:onboarding'],
})

import { defineStarforgeModule } from '@/core/modules/define-module'

/** cookie-settings particle — reopen consent choices; requires product:consent. */
export default defineStarforgeModule({
  id: 'cookie-settings',
  kind: 'particle',
  layer: 'site',
  label: 'Cookie settings',
  description:
    'Reopen cookie preferences after a choice exists. Needs product:consent. Seed places it in Footer.',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/consent/particles/cookie-settings-module',
  exportName: 'cookieSettingsModule',
  requires: ['product:consent'],
})

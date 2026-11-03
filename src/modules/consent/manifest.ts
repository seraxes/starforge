import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:consent — cookie banner + preference cookie.
 * Public UI contributes via `publicShell` (bodyEnd); Core layout hosts the slot.
 */
export default defineStarforgeModule({
  id: 'product:consent',
  kind: 'product',
  label: 'Consent',
  description:
    'Cookie consent banner + preference cookie (sf-consent). Policy copy under Chrome; gates atom:analytics until analytics is accepted.',
  version: '0.1.0',
  defaultEnabled: true,
  publicShell: [
    {
      slot: 'bodyEnd',
      importPath: '@/modules/consent/public/ConsentShell',
      exportName: 'default',
      component: () => import('./public/ConsentShell'),
    },
  ],
})

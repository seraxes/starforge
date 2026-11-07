import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:pwa — Progressive Web App (installable manifest + Serwist SW).
 * v0: installability only; no offline shell / push / install CTA particle.
 */
export default defineStarforgeModule({
  id: 'product:pwa',
  kind: 'product',
  label: 'PWA',
  description:
    'Progressive Web App — Web App Manifest + service worker (Serwist). Opt-in installability; reuses Site Chrome name and Page Settings icons.',
  version: '0.1.0',
  defaultEnabled: false,
  navViews: [
    { key: 'settings', label: 'PWA settings', href: '/admin/pwa' },
    { key: 'admin', label: 'PWA', href: '/admin/pwa' },
  ],
  admin: {
    navGroup: {
      id: 'pwa',
      label: 'PWA',
      href: '/admin/pwa',
      order: 72,
    },
    nav: [
      {
        group: 'pwa',
        label: 'Settings',
        href: '/admin/pwa',
        order: 10,
        area: 'pwa',
      },
    ],
    areas: [{ key: 'pwa', label: 'PWA' }],
    routes: [
      {
        path: 'pwa',
        pageImportPath: '@/modules/pwa/admin/PwaSettingsPage',
        pageExportName: 'default',
      },
    ],
  },
  publicShell: [
    {
      slot: 'head',
      importPath: '@/modules/pwa/public/PwaHead',
      exportName: 'default',
      component: () => import('./public/PwaHead'),
    },
    {
      slot: 'bodyEnd',
      importPath: '@/modules/pwa/public/PwaRegister',
      exportName: 'default',
      component: () => import('./public/PwaRegister'),
    },
  ],
})

import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:forms — Form engine capability (admin + particle gate).
 * Engine lives in this folder. Other packs import `@/modules/forms/api` only.
 */
export default defineStarforgeModule({
  id: 'product:forms',
  kind: 'product',
  label: 'Forms',
  description:
    'Modular Form engine — visual builder (JSON Schema/Zod), Form particle, typed presets (contact, survey, event-registration, voting, ticket). Captcha from Chrome; Turnstile keys from env.',
  version: '0.1.0',
  defaultEnabled: true,
  requires: ['product:media'],
  i18n: {
    namespaces: ['product:forms'],
  },
  navViews: [{ key: 'admin', label: 'Forms', href: '/admin/forms' }],
  admin: {
    navGroup: {
      id: 'forms',
      label: 'Forms',
      href: '/admin/forms',
      expandable: true,
      order: 40,
    },
    nav: [
      {
        group: 'forms',
        label: 'Forms',
        href: '/admin/forms',
        order: 10,
        area: 'forms',
        exact: true,
      },
      {
        group: 'forms',
        label: 'Settings',
        href: '/admin/forms/settings',
        order: 20,
        area: 'forms',
      },
    ],
    areas: [{ key: 'forms', label: 'Forms' }],
    dashboard: [
      {
        id: 'forms.submissions',
        title: 'Forms',
        order: 42,
        size: 'sm',
        // Dashboard ACL only — soft overview; full inbox stays under Forms admin.
        widgetImportPath: '@/modules/forms/dashboard/FormsSubmissionsWidget',
        widgetExportName: 'FormsSubmissionsWidget',
        statsImportPath: '@/modules/forms/dashboard/forms-stats',
        statsExportName: 'loadFormsSubmissionsStats',
      },
    ],
  },
})

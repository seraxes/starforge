import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:email-manager — shared automatic/conditional email rules + templates.
 * Transport is Core Mailer (Site Chrome / env secrets). No per-module SMTP.
 */
export default defineStarforgeModule({
  id: 'product:email-manager',
  kind: 'product',
  label: 'Email Manager',
  description:
    'Automatic and conditional email rules with templates, filtered by module. Modules emit triggers; Core Mailer sends. No per-module SMTP — secrets stay in env / Chrome.',
  version: '0.1.0',
  defaultEnabled: true,
  navViews: [
    { key: 'admin', label: 'Email rules', href: '/app/admin/email' },
    { key: 'templates', label: 'Email templates', href: '/app/admin/email/templates' },
  ],
  admin: {
    navGroup: {
      id: 'email',
      label: 'Email',
      href: '/app/admin/email',
      expandable: true,
      order: 45,
    },
    nav: [
      {
        group: 'email',
        label: 'Rules',
        href: '/app/admin/email',
        order: 10,
        area: 'email-manager',
        exact: true,
      },
      {
        group: 'email',
        label: 'Templates',
        href: '/app/admin/email/templates',
        order: 20,
        area: 'email-manager',
      },
    ],
    areas: [{ key: 'email-manager', label: 'Email Manager' }],
    routes: [
      {
        path: 'email',
        pageImportPath: '@/modules/email-manager/admin/EmailRulesPage',
        pageExportName: 'default',
      },
      {
        path: 'email/templates',
        pageImportPath: '@/modules/email-manager/admin/EmailTemplatesPage',
        pageExportName: 'default',
      },
    ],
  },
  db: { schema: 'src/modules/email-manager/schema.ts' },
})

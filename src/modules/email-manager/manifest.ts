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
    'Automatic and conditional email rules with templates, filtered by module. Modules emit triggers; Core Mailer sends. No per-module SMTP — secrets stay in env / Chrome. HTML bodies use product:rich-editor (email preset).',
  version: '0.1.0',
  defaultEnabled: true,
  requires: ['product:rich-editor', 'product:media'],
  i18n: {
    namespaces: ['product:email-manager'],
  },
  navViews: [
    { key: 'admin', label: 'Email rules', href: '/admin/email' },
    { key: 'templates', label: 'Email templates', href: '/admin/email/templates' },
    { key: 'sends', label: 'Email sends', href: '/admin/email/sends' },
    { key: 'broadcasts', label: 'Email broadcasts', href: '/admin/email/broadcasts' },
  ],
  admin: {
    navGroup: {
      id: 'email',
      label: 'Email',
      href: '/admin/email',
      expandable: true,
      order: 45,
    },
    nav: [
      {
        group: 'email',
        label: 'Rules',
        href: '/admin/email',
        order: 10,
        area: 'email-manager',
        exact: true,
      },
      {
        group: 'email',
        label: 'Templates',
        href: '/admin/email/templates',
        order: 20,
        area: 'email-manager',
      },
      {
        group: 'email',
        label: 'Sends',
        href: '/admin/email/sends',
        order: 30,
        area: 'email-manager',
      },
      {
        group: 'email',
        label: 'Broadcasts',
        href: '/admin/email/broadcasts',
        order: 40,
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
      {
        path: 'email/sends',
        pageImportPath: '@/modules/email-manager/admin/EmailSendsPage',
        pageExportName: 'default',
      },
      {
        path: 'email/broadcasts',
        pageImportPath: '@/modules/email-manager/admin/EmailBroadcastsPage',
        pageExportName: 'default',
      },
    ],
    dashboard: [
      {
        id: 'email.sent',
        title: 'Email',
        order: 39,
        size: 'sm',
        // Real counts from sf_email_sends (D3); soft-fail when log unreachable.
        widgetImportPath: '@/modules/email-manager/dashboard/EmailSentWidget',
        widgetExportName: 'EmailSentWidget',
        statsImportPath: '@/modules/email-manager/dashboard/email-stats',
        statsExportName: 'loadEmailSentStats',
      },
    ],
  },
  db: { schema: 'src/modules/email-manager/schema.ts' },
})

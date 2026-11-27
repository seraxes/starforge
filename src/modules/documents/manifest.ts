import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:documents — slice 5: Core signature port + send / webhook.
 * Plan: docs/project-context/docs/documents-build-spec.md
 */
export default defineStarforgeModule({
  id: 'product:documents',
  kind: 'product',
  layer: 'advanced',
  label: 'Documents',
  description:
    'Shared document templates and subject links. Media keeps file bytes. Default off until a site turns it on.',
  version: '0.5.0',
  defaultEnabled: false,
  requires: ['product:media'],
  navViews: [{ key: 'admin', label: 'Documents', href: '/admin/documents' }],
  admin: {
    navGroup: {
      id: 'documents',
      label: 'Documents',
      href: '/admin/documents',
      expandable: false,
      order: 57,
    },
    nav: [
      {
        group: 'documents',
        label: 'Documents',
        href: '/admin/documents',
        order: 10,
        area: 'documents',
        exact: true,
      },
    ],
    areas: [{ key: 'documents', label: 'Documents' }],
    routes: [
      {
        path: 'documents',
        pageImportPath: '@/modules/documents/admin/DocumentsAdminPage',
        pageExportName: 'default',
      },
    ],
  },
  doors: [
    { id: 'documents-api', importPath: '@/modules/documents/api' },
    { id: 'documents-api-server', importPath: '@/modules/documents/api.server' },
  ],
  db: { schema: 'src/modules/documents/schema.ts' },
})

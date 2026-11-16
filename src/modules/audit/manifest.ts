import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:audit — optional company reader for the Core admin audit log.
 * The table and the writer stay in Core (`sf_admin_audit`, `recordAdminAudit`).
 * This pack adds the filtered reader, CSV export, and the extra activity rows.
 */
export default defineStarforgeModule({
  id: 'product:audit',
  kind: 'product',
  layer: 'site',
  label: 'Audit log',
  description:
    'Optional who-did-what log for companies. Reads the Core admin audit trail. Off until Site Settings → Modules turns it on.',
  version: '0.1.0',
  defaultEnabled: false,
  admin: {
    areas: [{ key: 'audit', label: 'Audit log' }],
  },
  doors: [{ id: 'audit-log', importPath: '@/modules/audit/admin/AuditLogPanel' }],
  apiRoutes: [
    {
      path: 'admin/audit/export',
      routeImportPath: '@/modules/audit/routes/export-route',
      handlers: ['GET'],
      dynamic: 'force-dynamic',
    },
  ],
})

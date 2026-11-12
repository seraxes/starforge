import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:media — required Media library module pack (design M5).
 *
 * Library + Settings admin UI: `src/modules/media/admin/*`
 * Public bind contract: `@/modules/media/api` (`mediaId` + MediaPicker)
 * Ports stay Core: MediaStorage, sharp pipeline, MediaAnalysisPort, resolve helpers
 *
 * Site Settings → Modules shows this row locked on (Logo/Styles/Forms bind mediaId).
 */
export default defineStarforgeModule({
  id: 'product:media',
  kind: 'product',
  label: 'Media library',
  description:
    'Single Payload Media library with sharp WebP/PNG pipeline, Spaces/S3 storage port, tags filter, member upload ledger, and MediaAnalysisPort hooks. Required — Logo/Styles/Forms bind by mediaId.',
  version: '0.3.0',
  required: true,
  defaultEnabled: true,
  admin: {
    navGroup: {
      id: 'media',
      label: 'Media',
      href: '/admin/media',
      expandable: true,
      defaultOpen: true,
      order: 60,
    },
    nav: [
      {
        group: 'media',
        label: 'Library',
        href: '/admin/media',
        order: 10,
        area: 'media',
        exact: true,
      },
      {
        group: 'media',
        label: 'Settings',
        href: '/admin/media/settings',
        order: 20,
        area: 'media',
      },
    ],
    areas: [{ key: 'media', label: 'Media library' }],
    /** Codegen writes App Router shims under admin/(modules)/ — no hand Core pages. */
    routes: [
      {
        path: 'media',
        pageImportPath: '@/modules/media/admin/MediaLibraryPage',
        pageExportName: 'default',
      },
      {
        path: 'media/settings',
        pageImportPath: '@/modules/media/admin/MediaSettingsPage',
        pageExportName: 'default',
      },
    ],
    dashboard: [
      {
        id: 'media.counts',
        title: 'Media',
        order: 44,
        size: 'sm',
        // Dashboard ACL only — Media path is still app-admin gated; soft card is overview.
        widgetImportPath: '@/modules/media/dashboard/MediaCountsWidget',
        widgetExportName: 'MediaCountsWidget',
        statsImportPath: '@/modules/media/dashboard/media-stats',
        statsExportName: 'loadMediaCountsStats',
      },
    ],
  },
  navViews: [
    { key: 'admin', label: 'Media library', href: '/admin/media' },
    { key: 'settings', label: 'Media settings', href: '/admin/media/settings' },
  ],
  /** `sf_media_owners` — member upload ownership ledger. */
  db: { schema: 'src/modules/media/schema.ts' },
})

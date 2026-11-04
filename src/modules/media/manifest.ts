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
    'Single Payload Media library with sharp WebP/PNG pipeline, Spaces/S3 storage port, tags filter, and MediaAnalysisPort hooks. Required — Logo/Styles/Forms bind by mediaId.',
  version: '0.2.0',
  required: true,
  defaultEnabled: true,
  admin: {
    navGroup: {
      id: 'media',
      label: 'Media',
      href: '/app/admin/media',
      expandable: true,
      defaultOpen: true,
      order: 60,
    },
    nav: [
      {
        group: 'media',
        label: 'Library',
        href: '/app/admin/media',
        order: 10,
        area: 'media',
        exact: true,
      },
      {
        group: 'media',
        label: 'Settings',
        href: '/app/admin/media/settings',
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
  },
  navViews: [
    { key: 'admin', label: 'Media library', href: '/app/admin/media' },
    { key: 'settings', label: 'Media settings', href: '/app/admin/media/settings' },
  ],
})

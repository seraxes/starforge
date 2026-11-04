import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:media — Media library module boundary stub (SF-148 / design M5 start).
 * Library UX + pipeline still live under `src/core/media` and `/app/admin/media`;
 * this manifest makes Media a required catalog row (locked on). Full UI move later.
 */
export default defineStarforgeModule({
  id: 'product:media',
  kind: 'product',
  label: 'Media library',
  description:
    'Single Payload Media library with sharp WebP/PNG pipeline, Spaces/S3 storage port, tags filter, and MediaAnalysisPort hooks. Required — Logo/Styles/Forms bind by mediaId.',
  version: '0.1.0',
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
  },
  navViews: [
    { key: 'admin', label: 'Media library', href: '/app/admin/media' },
    { key: 'settings', label: 'Media settings', href: '/app/admin/media/settings' },
  ],
})

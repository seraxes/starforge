import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:profiles — member persona / identity layer.
 *
 * One `sf_profiles` row per account (handle, display name, avatar, cover, bio,
 * location, privacy per field). Every other pack (Events, Marketplace, Social,
 * Chat …) stores `userId` and resolves identity through
 * `@/modules/profiles/api.server` (`getPersonas`) — never copies names/avatars.
 */
export default defineStarforgeModule({
  id: 'product:profiles',
  kind: 'product',
  label: 'Profiles',
  description:
    'Member identity — username, display name, avatar/cover, bio, location and per-field privacy. The persona every other module (Events, Marketplace, Social…) resolves through getPersonas().',
  version: '0.1.0',
  defaultEnabled: true,
  requires: ['product:media'],
  navViews: [
    { key: 'account', label: 'My profile', href: '/account/profile' },
    { key: 'settings', label: 'Profiles settings', href: '/admin/profiles/settings' },
  ],
  admin: {
    navGroup: {
      id: 'profiles',
      label: 'Profiles',
      href: '/admin/profiles/settings',
      expandable: true,
      order: 46,
    },
    nav: [
      {
        group: 'profiles',
        label: 'Settings',
        href: '/admin/profiles/settings',
        order: 20,
        area: 'profiles',
      },
    ],
    areas: [{ key: 'profiles', label: 'Profiles' }],
    routes: [
      {
        path: 'profiles',
        pageImportPath: '@/modules/profiles/admin/ProfilesListPage',
        pageExportName: 'default',
      },
      {
        path: 'profiles/settings',
        pageImportPath: '@/modules/profiles/admin/ProfilesSettingsPage',
        pageExportName: 'default',
      },
      {
        path: 'profiles/[userId]',
        pageImportPath: '@/modules/profiles/admin/ProfileEditPage',
        pageExportName: 'default',
      },
    ],
  },
  db: { schema: 'src/modules/profiles/schema.ts' },
})

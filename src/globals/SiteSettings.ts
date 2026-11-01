import type { GlobalAfterChangeHook, GlobalConfig } from 'payload'

import { invalidateSiteSettings } from '../core/content/revalidate'

const revalidateSiteSettingsAfterChange: GlobalAfterChangeHook = ({ doc }) => {
  invalidateSiteSettings()
  return doc
}

/**
 * Site settings + product capability toggles.
 *
 * - Editors: edit in Payload `/admin` → Globals → Site settings
 * - Core admins: edit the same doc via `/app/admin/settings` (Local API)
 *
 * Navigation sets live in Core **Nav** (`/app/admin/nav`, `sf_nav_menus`) — a
 * top-level admin sibling of Site settings, not nested under Site Chrome.
 * This global only assigns which menu is the site default (`primaryNavMenuId`).
 * Legacy `primaryNav` array is a read fallback until migrated.
 *
 * Flags are product *capabilities* (registration, modules, posts placeholder…),
 * not npm libraries. Core reads them to hide UI and reject gated APIs.
 *
 * Saves invalidate the published-content cache tag for site chrome / nav.
 */
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site settings',
  admin: {
    description:
      'Site name, primary nav menu assignment, and feature toggles. Manage menus under Starforge admin → Nav (top-level). Core admins: /app/admin/settings.',
  },
  hooks: {
    afterChange: [revalidateSiteSettingsAfterChange],
  },
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'siteName',
      type: 'text',
      required: true,
      defaultValue: 'Starforge',
      admin: {
        description: 'Shown in the public site header / brand.',
      },
    },
    {
      name: 'primaryNavMenuId',
      type: 'text',
      defaultValue: 'main',
      admin: {
        description:
          'Assignment only: which Nav menu set (`sf_nav_menus`) powers the public header. Edit sets under Starforge admin → Nav (top-level). Default: main.',
      },
    },
    {
      name: 'primaryNav',
      type: 'array',
      labels: {
        singular: 'Nav item',
        plural: 'Legacy primary nav',
      },
      admin: {
        // Hidden: Core Site Settings no longer edits items. Migrated into sf_nav_menus Main.
        hidden: true,
        description:
          'Legacy storage only — migrated into Nav manager Main. Do not edit; use /app/admin/nav.',
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'linkType',
          type: 'select',
          required: true,
          defaultValue: 'page',
          options: [
            { label: 'CMS page', value: 'page' },
            { label: 'Custom URL', value: 'custom' },
          ],
          admin: {
            description: 'Page relationship (preferred) or a path / absolute URL.',
          },
        },
        {
          name: 'page',
          type: 'relationship',
          relationTo: 'pages',
          admin: {
            condition: (_data, siblingData) => siblingData?.linkType === 'page',
            description: 'Published page rendered at /{slug}.',
          },
        },
        {
          name: 'url',
          type: 'text',
          admin: {
            condition: (_data, siblingData) => siblingData?.linkType === 'custom',
            description: 'Path (/about) or absolute URL (https://…).',
          },
        },
        {
          name: 'cssClass',
          type: 'text',
          admin: {
            description: 'Legacy stub — use Nav manager item CSS class instead.',
          },
        },
        {
          name: 'browserTitle',
          type: 'text',
          admin: {
            description: 'Legacy stub — use Nav manager browser title instead.',
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Feature toggles',
      admin: {
        description:
          'Turn optional Starforge capabilities on/off. Core enforces these (hide UI + reject APIs).',
        initCollapsed: false,
      },
      fields: [
        {
          name: 'featureRegistration',
          type: 'checkbox',
          label: 'Registration',
          defaultValue: true,
          admin: {
            description:
              'Allow new app accounts via /register. When off, the link is hidden and signup is rejected.',
          },
        },
        {
          name: 'featureRichEditor',
          type: 'checkbox',
          label: 'Rich editor (Lexical)',
          defaultValue: true,
          admin: {
            description:
              'Product flag for richer page editing. Lexical stays wired in Pages for now; off is reserved for a future simpler mode.',
          },
        },
        {
          name: 'featurePosts',
          type: 'checkbox',
          label: 'Posts (placeholder)',
          defaultValue: false,
          admin: {
            description: 'Placeholder — Posts collection not shipped yet. Keep off until P2.',
          },
        },
        {
          name: 'featureModules',
          type: 'checkbox',
          label: 'Modules (legacy master)',
          defaultValue: false,
          admin: {
            description:
              'Legacy master flag. Prefer the Modules list below (per particle/atom). Kept in sync when any extension particle is on.',
          },
        },
        {
          name: 'featureDraftPreview',
          type: 'checkbox',
          label: 'Draft preview',
          defaultValue: false,
          admin: {
            description:
              'Allow users with CMS access to open /preview/{slug} and see unpublished page drafts. Anonymous visitors still only see published /{slug}.',
          },
        },
      ],
    },
    {
      name: 'moduleToggles',
      type: 'array',
      labels: {
        singular: 'Module toggle',
        plural: 'Modules',
      },
      admin: {
        description:
          'Per installed particle / atom on/off (P0). Core admins edit the same list at /app/admin/settings → Modules. Disabled = hidden from layout palette and skipped on public/atoms.',
      },
      fields: [
        {
          name: 'moduleId',
          type: 'text',
          required: true,
          admin: {
            description: 'Registry id (e.g. notice-bar) or atom:analytics.',
          },
        },
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: true,
          label: 'Enabled',
        },
      ],
    },
  ],
}

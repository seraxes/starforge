import type { GlobalAfterChangeHook, GlobalConfig } from 'payload'

import { invalidateSiteSettings } from '../core/content/revalidate'

const revalidateSiteSettingsAfterChange: GlobalAfterChangeHook = ({ doc }) => {
  invalidateSiteSettings()
  return doc
}

/**
 * Site chrome + product capability toggles.
 *
 * - Editors: edit in Payload `/admin` → Globals → Site settings
 * - Core admins: edit the same doc via `/app/admin/settings` (Local API)
 *
 * Primary nav items prefer a **Page** relationship; custom URL is for external
 * links or paths. Flat menu for v1 — Joomla-like extras (CSS class, browser
 * title override) are stub fields only; not used by the public layout yet.
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
      'Site name, primary nav (pages / URLs), and feature toggles. Core admins can also edit at /app/admin/settings. App accounts stay separate from CMS editors. Saving refreshes the public header cache.',
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
      name: 'primaryNav',
      type: 'array',
      labels: {
        singular: 'Nav item',
        plural: 'Primary nav',
      },
      admin: {
        description:
          'Ordered header links. Prefer “CMS page” so URLs stay in sync with the page slug. Custom URL for external links or fixed paths. Nested menus / module assignment come later.',
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
            description:
              'Stub — reserved for later Joomla-like menu CSS class. Not applied on the public site yet.',
          },
        },
        {
          name: 'browserTitle',
          type: 'text',
          admin: {
            description:
              'Stub — reserved for later browser / page title override when this item is active. Not applied yet.',
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
          label: 'Modules',
          defaultValue: false,
          admin: {
            description:
              'Render extension modules in named layout positions (e.g. notice bar in header). Off = all ModuleSlots empty.',
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
  ],
}

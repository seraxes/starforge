import type { GlobalConfig } from 'payload'

/**
 * Site chrome + product capability toggles.
 *
 * - Editors: edit in Payload `/admin` → Globals → Site settings
 * - Core admins: edit the same doc via `/app/admin/settings` (Local API)
 *
 * Flags are product *capabilities* (registration, posts placeholder, modules…),
 * not npm libraries. Core reads them to hide UI and reject gated APIs.
 */
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site settings',
  admin: {
    description:
      'Site name, primary nav, and feature toggles. Core admins can also edit at /app/admin/settings. App accounts stay separate from CMS editors.',
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
        description: 'Links in the public site header. Use paths like /about or full URLs.',
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'href',
          type: 'text',
          required: true,
          admin: {
            description: 'Path (/about) or absolute URL.',
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
            description: 'Allow new app accounts via /register. When off, the link is hidden and signup is rejected.',
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
          label: 'Modules (placeholder)',
          defaultValue: false,
          admin: {
            description: 'Placeholder for extension modules (contact, notice bar, …). Keep off until the first module lands.',
          },
        },
        {
          name: 'featureDraftPreview',
          type: 'checkbox',
          label: 'Draft preview (placeholder)',
          defaultValue: false,
          admin: {
            description: 'Placeholder — draft preview slice is next. No public preview path yet.',
          },
        },
      ],
    },
  ],
}

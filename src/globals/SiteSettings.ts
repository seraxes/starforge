import type { GlobalAfterChangeHook, GlobalConfig } from 'payload'

import { isCoreAdmin } from '@/core/cms-bridge/payload-access'
import { invalidateSiteSettings } from '../core/content/revalidate'

const revalidateSiteSettingsAfterChange: GlobalAfterChangeHook = async ({ doc }) => {
  await invalidateSiteSettings()
  return doc
}

/**
 * Site settings + product capability toggles (Modules).
 *
 * - Editors: edit in Payload `/cms/admin` → Globals → Site settings
 * - Core admins: topic pages under `/admin/settings` (Modules, Admin UX,
 *   Auth, Security, Performance).
 *
 * Site-wide policy (offline, metadata, robots, cookies, email) lives in Core
 * **Site Chrome** (`/admin/site-chrome`, `sf_site_chrome`) — not here.
 * Captcha enable/provider is edited under Site Settings → Security
 * (still stored on Site Chrome JSON). `siteName` syncs when Site Chrome saves.
 *
 * Navigation sets live in Core **Nav** (`/admin/nav`, `sf_nav_menus`) — a
 * top-level admin sibling. This global only assigns which menu is the site
 * default (`primaryNavMenuId`). Legacy `primaryNav` array is a read fallback.
 *
 * Flags are product *capabilities* (registration, modules, posts placeholder…),
 * not npm libraries. Core reads them to hide UI and reject gated APIs.
 *
 * Saves invalidate the published-content cache tag for site settings / nav.
 */
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site settings',
  admin: {
    description:
      'Primary nav assignment + module/feature toggles. Topics: /admin/settings (Modules, Admin UX, Auth, Security, Performance). Chrome (offline/metadata/robots/email): /admin/site-chrome. Menus: Navigation.',
  },
  hooks: {
    afterChange: [revalidateSiteSettingsAfterChange],
  },
  access: {
    read: () => true,
    // Module toggles / registration — Core app admins only (not any CMS editor).
    update: isCoreAdmin,
  },
  fields: [
    {
      name: 'siteName',
      type: 'text',
      required: true,
      defaultValue: 'Starforge',
      admin: {
        description:
          'Synced from Starforge admin → Chrome. Prefer editing site name there.',
      },
    },
    {
      name: 'primaryNavMenuId',
      type: 'text',
      defaultValue: 'main',
      admin: {
        description:
          'Assignment only: which Navigation menu set (`sf_nav_menus`) powers the public header. Edit sets under Starforge admin → Navigation (top-level). Default: main.',
      },
    },
    {
      name: 'adminAutosaveDebounceMs',
      type: 'number',
      defaultValue: 800,
      min: 300,
      max: 2000,
      admin: {
        description:
          'Core /admin text-field autosave delay in milliseconds (300–2000). Blur still saves immediately. Prefer Starforge admin → Settings → Admin UX.',
      },
    },
    {
      name: 'formRateLimitMax',
      type: 'number',
      defaultValue: 8,
      min: 1,
      max: 100,
      admin: {
        description:
          'Max public Form submissions per IP + form key within the window (1–100). Prefer Starforge admin → Settings → Performance. Redis URL stays in Environment.',
      },
    },
    {
      name: 'formRateLimitWindowSec',
      type: 'number',
      defaultValue: 60,
      min: 10,
      max: 3600,
      admin: {
        description:
          'Form submit rate-limit window in seconds (10–3600). Prefer Starforge admin → Settings → Performance. Cache backend / REDIS_URL stay in Environment.',
      },
    },
    {
      name: 'publishedCacheEnabled',
      type: 'checkbox',
      defaultValue: true,
      label: 'Published content cache',
      admin: {
        description:
          'When off, published pages/settings always load fresh (bypass Next/Redis adapters). Backend enum + REDIS_URL stay in Environment. Prefer Starforge admin → Settings → Performance.',
      },
    },
    {
      name: 'publishedCacheTtlSec',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 86400,
      admin: {
        description:
          'Published-content TTL in seconds (0 = until tag invalidation). Prefer Starforge admin → Settings → Performance.',
      },
    },
    {
      name: 'nullMissTtlSec',
      type: 'number',
      defaultValue: 60,
      min: 1,
      max: 3600,
      admin: {
        description:
          'Redis null-miss marker TTL in seconds (1–3600). Ignored by the Next.js tag cache. Prefer Starforge admin → Settings → Performance.',
      },
    },
    {
      name: 'dashboardRefreshIntervalSec',
      type: 'number',
      defaultValue: 60,
      min: 15,
      max: 600,
      admin: {
        description:
          'Admin Dashboard soft-refresh interval in seconds (15–600). Prefer Starforge admin → Settings → Performance.',
      },
    },
    {
      name: 'dashboardOnlineWindowMin',
      type: 'number',
      defaultValue: 15,
      min: 5,
      max: 120,
      admin: {
        description:
          'Dashboard “online now” session activity window in minutes (5–120). Prefer Starforge admin → Settings → Performance.',
      },
    },
    {
      name: 'realtimeEnabled',
      type: 'checkbox',
      defaultValue: true,
      label: 'RealtimePort (SSE)',
      admin: {
        description:
          'When off, RealtimePort publish does not fan out and /api/realtime refuses connections. Used by upcoming Notifications / Chat / live Maps. Prefer Starforge admin → Settings → Performance.',
      },
    },
    {
      name: 'primaryNav',
      type: 'array',
      labels: {
        singular: 'Navigation item',
        plural: 'Legacy primary nav',
      },
      admin: {
        // Hidden: Core Site Settings no longer edits items. Migrated into sf_nav_menus Main.
        hidden: true,
        description:
          'Legacy storage only — migrated into Navigation manager Main. Do not edit; use /admin/nav.',
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
            description: 'Legacy stub — use Navigation manager item CSS class instead.',
          },
        },
        {
          name: 'browserTitle',
          type: 'text',
          admin: {
            description: 'Legacy stub — use Navigation manager browser title instead.',
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
          label: 'Rich editor (TipTap)',
          defaultValue: true,
          admin: {
            description:
              'Product flag for TipTap rich editing (synced from product:rich-editor). Optional Lexical is product:lexical-editor.',
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
          'Per installed particle / atom on/off (P0). Core admins edit the same list at /admin/settings → Modules. Disabled = hidden from layout palette and skipped on public/atoms.',
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

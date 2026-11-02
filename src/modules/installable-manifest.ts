/**
 * Source catalog of installable Starforge modules for `npm run modules:generate`.
 * Codegen reads this + `starforge.modules.json` (or `SF_MODULES`) and writes
 * `src/generated/module-registry.ts`. Keep ids aligned with Site Settings MODULE_IDS.
 */

export type InstallableKind = 'platform' | 'product' | 'particle' | 'atom'

export type InstallableNavView = {
  key: string
  label: string
  href: string
}

export type InstallableEntry = {
  id: string
  kind: InstallableKind
  label: string
  description: string
  /** Locked on / always treated as installed when present in flavor. */
  required?: boolean
  defaultEnabled?: boolean
  /** Core builtin particle — registered from `@/core/modules/particles`, not dynamic import. */
  builtin?: boolean
  /** Legacy FeatureFlags bridge for product rows / notice-bar. */
  featureFlag?: 'registration' | 'richEditor' | 'posts' | 'modules' | 'draftPreview'
  navViews?: InstallableNavView[]
  /**
   * Dynamic import target for optional particles/atoms.
   * Omitted for platform/product (catalog-only) and builtin particles.
   */
  importPath?: string
  exportName?: string
  /** Other allowlist ids that should also be present (warn-only in codegen). */
  requires?: string[]
}

/**
 * Full installable surface for the core flavor. Allowlist subsets this list;
 * ids not listed here cannot be generated into the registry.
 */
export const INSTALLABLE_MANIFEST: InstallableEntry[] = [
  {
    id: 'platform:better-auth',
    kind: 'platform',
    label: 'Better Auth',
    description:
      'Core app login, sessions, users, password reset, passwordless, and TOTP 2FA. Required — sole sign-in for Starforge.',
    required: true,
    defaultEnabled: true,
    navViews: [
      { key: 'login', label: 'Sign in', href: '/login' },
      { key: 'forgot-password', label: 'Forgot password', href: '/forgot-password' },
      { key: 'forgot-username', label: 'Forgot login email', href: '/forgot-username' },
      { key: 'account-security', label: 'Account security', href: '/account/security' },
    ],
  },
  {
    id: 'platform:payload-cms',
    kind: 'platform',
    label: 'Payload CMS',
    description:
      'Content CMS (/admin) for pages and media. Off hides CMS nav and blocks Payload admin entry when safe.',
    defaultEnabled: true,
    navViews: [{ key: 'admin', label: 'Content CMS', href: '/admin' }],
  },
  {
    id: 'product:layout-manager',
    kind: 'product',
    label: 'Layout manager / Outlines',
    description:
      'Gantry-like layout canvas and named outlines. Off hides Layout/Outlines admin and uses a minimal public shell.',
    defaultEnabled: true,
    navViews: [
      { key: 'layout', label: 'Layout canvas', href: '/app/admin/layouts' },
      { key: 'outlines', label: 'Outlines', href: '/app/admin/outlines' },
    ],
  },
  {
    id: 'product:page-settings',
    kind: 'product',
    label: 'Page Settings',
    description:
      'Document chrome (Head, Assets, Body, FA, Atoms) and layout assignment. Off hides Page settings admin and skips public chrome emit.',
    defaultEnabled: true,
    navViews: [{ key: 'page-settings', label: 'Page settings', href: '/app/admin/page-settings' }],
  },
  {
    id: 'product:primary-nav',
    kind: 'product',
    label: 'Primary nav',
    description:
      'Navigation manager + public header menu. Off hides Core admin → Navigation and public header links. Site Settings picks which menu set is the site default.',
    defaultEnabled: true,
    navViews: [{ key: 'nav-manager', label: 'Navigation manager', href: '/app/admin/nav' }],
  },
  {
    id: 'product:font-awesome',
    kind: 'product',
    label: 'Font Awesome',
    description:
      'Optional Font Awesome CDN from Layouts → Page settings / Font Awesome. Off skips FA assets on the public site.',
    defaultEnabled: true,
  },
  {
    id: 'product:registration',
    kind: 'product',
    label: 'Registration',
    description:
      'Allow /register for new app accounts. Also edited under Site Settings → Auth & registration.',
    defaultEnabled: true,
    featureFlag: 'registration',
    navViews: [{ key: 'register', label: 'Register', href: '/register' }],
  },
  {
    id: 'product:rich-editor',
    kind: 'product',
    label: 'Rich editor',
    description:
      'Lexical rich editing flag (Pages stay Lexical for now; off reserved for a simpler mode).',
    defaultEnabled: true,
    featureFlag: 'richEditor',
  },
  {
    id: 'product:posts',
    kind: 'product',
    label: 'Posts',
    description: 'Posts collection placeholder — keep off until that slice ships.',
    defaultEnabled: false,
    featureFlag: 'posts',
  },
  {
    id: 'product:draft-preview',
    kind: 'product',
    label: 'Draft preview',
    description: 'CMS-access users can open /preview/{slug} for unpublished drafts.',
    defaultEnabled: false,
    featureFlag: 'draftPreview',
  },
  {
    id: 'product:forms',
    kind: 'product',
    label: 'Forms',
    description:
      'Modular Form engine — visual builder (JSON Schema/Zod), Form particle, presets (contact + stubs). Captcha from Site Chrome; Turnstile keys from env.',
    defaultEnabled: true,
    navViews: [{ key: 'admin', label: 'Forms', href: '/app/admin/forms' }],
  },
  {
    id: 'page-content',
    kind: 'particle',
    label: 'Page content',
    description: 'Renders the assigned Payload page body in the layout Main section.',
    required: true,
    defaultEnabled: true,
    builtin: true,
  },
  {
    id: 'site-header',
    kind: 'particle',
    label: 'Site header',
    description: 'Built-in layout particle — site name + optional primary nav links.',
    defaultEnabled: true,
    builtin: true,
  },
  {
    id: 'logo',
    kind: 'particle',
    label: 'Logo / Image',
    description: 'Built-in — image (Media/URL) or text logo (font/size/weight/color).',
    defaultEnabled: true,
    builtin: true,
  },
  {
    id: 'menu',
    kind: 'particle',
    label: 'Menu',
    description: 'Built-in — Navigation manager menu set (default = site primary).',
    defaultEnabled: true,
    builtin: true,
  },
  {
    id: 'copyright',
    kind: 'particle',
    label: 'Copyright',
    description: 'Built-in — text + auto/manual year + link.',
    defaultEnabled: true,
    builtin: true,
  },
  {
    id: 'social',
    kind: 'particle',
    label: 'Social',
    description: 'Built-in — platform/url/label/icon list.',
    defaultEnabled: true,
    builtin: true,
  },
  {
    id: 'custom',
    kind: 'particle',
    label: 'Custom',
    description: 'Built-in HTML/CSS (+ JS stub); free-form escape hatch.',
    defaultEnabled: true,
    builtin: true,
  },
  {
    id: 'login',
    kind: 'particle',
    label: 'Login / Welcome',
    description:
      'Welcome note + sign-in panel (password / magic link / email OTP / stay signed in). Signed-in: Account security 2FA. Place in Main — not branded heroes.',
    defaultEnabled: true,
    builtin: true,
    navViews: [
      { key: 'login', label: 'Sign in', href: '/login' },
      { key: 'forgot-password', label: 'Forgot password', href: '/forgot-password' },
      { key: 'forgot-username', label: 'Forgot login email', href: '/forgot-username' },
      { key: 'account-security', label: 'Account security', href: '/account/security' },
    ],
  },
  {
    id: 'notice-bar',
    kind: 'particle',
    label: 'Notice bar',
    description: 'Dismissible site-wide notice. Seed places it in Header at 100%.',
    defaultEnabled: false,
    featureFlag: 'modules',
    importPath: '@/modules/notice-bar',
    exportName: 'noticeBarModule',
  },
  {
    id: 'form',
    kind: 'particle',
    label: 'Form',
    description:
      'Modular Form engine particle — contact and other presets via Admin → Forms. Optional Site Settings → Integrations captcha (Turnstile).',
    defaultEnabled: true,
    importPath: '@/modules/form',
    exportName: 'formModule',
    requires: ['product:forms'],
    navViews: [{ key: 'admin', label: 'Forms', href: '/app/admin/forms' }],
  },
  {
    id: 'atom:analytics',
    kind: 'atom',
    label: 'Analytics',
    description: 'Google Analytics (gtag) or a generic measurement id.',
    defaultEnabled: true,
    importPath: '@/core/page-settings/atoms/analytics',
    exportName: 'analyticsAtom',
  },
  {
    id: 'atom:custom-css-js',
    kind: 'atom',
    label: 'Custom CSS / JS',
    description: 'Inline stylesheet in head and optional script before </body>.',
    defaultEnabled: true,
    importPath: '@/core/page-settings/atoms/custom-css-js',
    exportName: 'customCssJsAtom',
  },
]

export function getInstallableEntry(id: string): InstallableEntry | undefined {
  return INSTALLABLE_MANIFEST.find((entry) => entry.id === id)
}

import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:rich-editor — shared TipTap + sanitized HTML content editor.
 * Engine lives in `src/core/rich-editor`; other packs bind via `@/modules/rich-editor/api`.
 * Runtime on/off: Site Settings → Modules (featureFlag richEditor).
 */
export default defineStarforgeModule({
  id: 'product:rich-editor',
  kind: 'product',
  label: 'Rich editor',
  description:
    'Shared TipTap rich editor (sanitized HTML). Toggle in Site Settings → Modules. Bind into Events, Pages, Email, and other content fields. Optional Lexical: product:lexical-editor.',
  version: '0.2.0',
  defaultEnabled: true,
  featureFlag: 'richEditor',
  navViews: [{ key: 'settings', label: 'Rich editor', href: '/admin/rich-editor/settings' }],
  admin: {
    navGroup: {
      id: 'rich-editor',
      label: 'Rich editor',
      href: '/admin/rich-editor/settings',
      expandable: false,
      order: 45,
    },
    nav: [
      {
        group: 'rich-editor',
        label: 'Settings',
        href: '/admin/rich-editor/settings',
        order: 10,
        area: 'rich-editor',
      },
    ],
    areas: [{ key: 'rich-editor', label: 'Rich editor' }],
    routes: [
      {
        path: 'rich-editor/settings',
        pageImportPath: '@/modules/rich-editor/admin/RichEditorSettingsPage',
        pageExportName: 'default',
      },
    ],
  },
})

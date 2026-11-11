import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:rich-editor — shared TipTap + sanitized HTML content editor.
 * Engine lives in this pack. Other packs bind via `@/modules/rich-editor/api`
 * and pass `MediaPicker` from `@/modules/media/api` (the editor does not import media).
 * Runtime on/off: Site Settings → Modules (featureFlag richEditor).
 */
export default defineStarforgeModule({
  id: 'product:rich-editor',
  kind: 'product',
  label: 'Rich editor',
  description:
    'Shared TipTap rich editor (sanitized HTML). Toggle in Site Settings → Modules. Bind into Events, Pages, Email Manager (preset=email), and other content fields. Optional Lexical: product:lexical-editor.',
  version: '0.2.0',
  defaultEnabled: true,
  featureFlag: 'richEditor',
  requires: ['product:media'],
  // Settings reachable from Site Settings → Modules only (no sidebar group).
  navViews: [{ key: 'settings', label: 'Rich editor', href: '/admin/rich-editor/settings' }],
  admin: {
    routes: [
      {
        path: 'rich-editor/settings',
        pageImportPath: '@/modules/rich-editor/admin/RichEditorSettingsPage',
        pageExportName: 'default',
      },
    ],
  },
})

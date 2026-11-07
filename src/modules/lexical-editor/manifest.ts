import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:lexical-editor — optional Payload Lexical stack.
 * Default CMS body is TipTap HTML (`product:rich-editor`). Keep this pack allowlisted
 * when you need legacy Lexical JSON rendering / opt-in Lexical field configs.
 */
export default defineStarforgeModule({
  id: 'product:lexical-editor',
  kind: 'product',
  label: 'Lexical editor',
  description:
    'Optional Lexical rich-text stack (@payloadcms/richtext-lexical). TipTap is the default editor. Enable for legacy Lexical page bodies and pagesLexicalEditor config; does not delete stored JSON when off.',
  version: '0.1.0',
  defaultEnabled: false,
  // Settings reachable from Site Settings → Modules only (no sidebar group).
  navViews: [{ key: 'settings', label: 'Lexical editor', href: '/admin/lexical-editor/settings' }],
  admin: {
    routes: [
      {
        path: 'lexical-editor/settings',
        pageImportPath: '@/modules/lexical-editor/admin/LexicalEditorSettingsPage',
        pageExportName: 'default',
      },
    ],
  },
})

import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * Form particle pack entry — allowlisted via dynamic import of `formModule`.
 */
export default defineStarforgeModule({
  id: 'form',
  kind: 'particle',
  label: 'Form',
  description:
    'Modular Form engine particle — contact and other presets via Admin → Forms. Optional Settings → Security captcha (Turnstile).',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/form',
  exportName: 'formModule',
  requires: ['product:forms'],
  navViews: [{ key: 'admin', label: 'Forms', href: '/app/admin/forms' }],
  configSchemaImportPath: '@/modules/form/schema',
  configSchemaExportName: 'formParticleConfigSchema',
  defaultsImportPath: '@/modules/form/schema',
  defaultsExportName: 'formParticleDefaults',
  editorImportPath: '@/app/(frontend)/app/admin/layouts/typed-particle-editors',
  editorExportName: 'FormParticleEditor',
})

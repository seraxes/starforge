import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:forms — Form engine capability (admin + particle gate).
 * Engine code still lives in `src/core/forms` until M4; this manifest is the
 * catalog / allowlist contribution so Core need not hardcode the row.
 */
export default defineStarforgeModule({
  id: 'product:forms',
  kind: 'product',
  label: 'Forms',
  description:
    'Modular Form engine — visual builder (JSON Schema/Zod), Form particle, presets (contact + stubs). Captcha from Chrome; Turnstile keys from env.',
  version: '0.1.0',
  defaultEnabled: true,
  navViews: [{ key: 'admin', label: 'Forms', href: '/app/admin/forms' }],
  admin: {
    nav: [{ group: 'Content', label: 'Forms', href: '/app/admin/forms', order: 40, area: 'forms' }],
    areas: [{ key: 'forms', label: 'Forms' }],
  },
})

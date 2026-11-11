import { z } from 'zod'

import { normalizeLocaleTextMap } from '@/core/i18n/locale-text'

export const customParticleConfigSchema = z
  .object({
    title: z.string().optional(),
    titleLocales: z.record(z.string(), z.string()).optional(),
    html: z.string().optional(),
    htmlLocales: z.record(z.string(), z.string()).optional(),
    css: z.string().optional(),
    js: z.string().optional(),
  })
  .transform((raw) => ({
    title: typeof raw.title === 'string' ? raw.title.trim() : '',
    titleLocales: normalizeLocaleTextMap(raw.titleLocales),
    html: typeof raw.html === 'string' ? raw.html : '',
    htmlLocales: normalizeLocaleTextMap(raw.htmlLocales),
    css: typeof raw.css === 'string' ? raw.css : '',
    js: typeof raw.js === 'string' ? raw.js : '',
  }))

export function customParticleDefaults() {
  return {
    title: 'Custom',
    html: '<p>Custom HTML</p>',
    css: '',
    js: '',
  }
}

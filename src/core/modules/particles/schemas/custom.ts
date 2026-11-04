import { z } from 'zod'

export const customParticleConfigSchema = z
  .object({
    title: z.string().optional(),
    html: z.string().optional(),
    css: z.string().optional(),
    js: z.string().optional(),
  })
  .transform((raw) => ({
    title: typeof raw.title === 'string' ? raw.title.trim() : '',
    html: typeof raw.html === 'string' ? raw.html : '',
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

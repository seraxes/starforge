import { z } from 'zod'

import { defaultSocialConfig, readSocialConfig } from '../config'

export const socialParticleConfigSchema = z
  .object({
    items: z.array(z.unknown()).optional(),
  })
  .transform((raw) => {
    const items = Array.isArray(raw.items) ? raw.items : []
    return { items: readSocialConfig({ items }).items }
  })

export function socialParticleDefaults() {
  return { ...defaultSocialConfig() }
}

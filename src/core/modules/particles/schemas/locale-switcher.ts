import { z } from 'zod'

import { defaultLocaleSwitcherConfig } from '../config'

export const localeSwitcherParticleConfigSchema = z
  .object({
    ariaLabel: z.string().optional(),
    display: z.enum(['labels', 'codes']).optional(),
  })
  .transform((raw) => ({
    ariaLabel:
      typeof raw.ariaLabel === 'string' && raw.ariaLabel.trim() ? raw.ariaLabel.trim() : '',
    display: raw.display === 'codes' ? ('codes' as const) : ('labels' as const),
  }))

export function localeSwitcherParticleDefaults() {
  return { ...defaultLocaleSwitcherConfig() }
}

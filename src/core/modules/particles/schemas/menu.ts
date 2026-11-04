import { z } from 'zod'

import { defaultMenuConfig } from '../config'

export const menuParticleConfigSchema = z
  .object({
    menuId: z.string().optional(),
    ariaLabel: z.string().optional(),
  })
  .transform((raw) => {
    const menuIdRaw = typeof raw.menuId === 'string' ? raw.menuId.trim() : ''
    return {
      menuId: menuIdRaw === 'primary' ? '' : menuIdRaw,
      ariaLabel:
        typeof raw.ariaLabel === 'string' && raw.ariaLabel.trim()
          ? raw.ariaLabel.trim()
          : 'Primary',
    }
  })

export function menuParticleDefaults() {
  return { ...defaultMenuConfig() }
}

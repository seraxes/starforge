import { z } from 'zod'

import {
  clampAccountMenuAvatarSize,
  defaultAccountMenuConfig,
  normalizeAccountMenuAvatarShape,
  normalizeAccountMenuId,
} from '../config'

export const accountMenuParticleConfigSchema = z
  .object({
    avatarShape: z.string().optional(),
    avatarSize: z.union([z.number(), z.string()]).optional(),
    menuId: z.string().optional(),
  })
  .transform((raw) => {
    const defaults = defaultAccountMenuConfig()
    return {
      avatarShape: normalizeAccountMenuAvatarShape(raw.avatarShape ?? defaults.avatarShape),
      avatarSize: clampAccountMenuAvatarSize(raw.avatarSize, defaults.avatarSize),
      menuId: normalizeAccountMenuId(raw.menuId),
    }
  })

export function accountMenuParticleDefaults() {
  return { ...defaultAccountMenuConfig() }
}

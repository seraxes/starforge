import { z } from 'zod'

import {
  clampAccountMenuAvatarSize,
  defaultAccountMenuConfig,
  normalizeAccountMenuAvatarShape,
} from '../config'

export const accountMenuParticleConfigSchema = z
  .object({
    avatarShape: z.string().optional(),
    avatarSize: z.union([z.number(), z.string()]).optional(),
  })
  .transform((raw) => {
    const defaults = defaultAccountMenuConfig()
    return {
      avatarShape: normalizeAccountMenuAvatarShape(raw.avatarShape ?? defaults.avatarShape),
      avatarSize: clampAccountMenuAvatarSize(raw.avatarSize, defaults.avatarSize),
    }
  })

export function accountMenuParticleDefaults() {
  return { ...defaultAccountMenuConfig() }
}

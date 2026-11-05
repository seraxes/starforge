import { z } from 'zod'

import { defaultSpacerConfig } from '../config'

const SIZE_MIN = 1
const SIZE_MAX = 2400

function normalizePx(raw: unknown, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.round(n)))
}

export const spacerParticleConfigSchema = z
  .object({
    height: z.union([z.number(), z.string()]).optional(),
    width: z.union([z.number(), z.string()]).optional().nullable(),
  })
  .transform((raw) => {
    const defaults = defaultSpacerConfig()
    const height = normalizePx(raw.height, defaults.height)
    if (raw.width == null || raw.width === '') {
      return { height }
    }
    const width = normalizePx(raw.width, 0)
    return width > 0 ? { height, width } : { height }
  })

export function spacerParticleDefaults() {
  return { ...defaultSpacerConfig() }
}

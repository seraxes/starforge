import { z } from 'zod'

import { defaultCopyrightConfig } from '../config'
import { normalizeLocaleTextMap } from '@/core/i18n/locale-text'

export const copyrightParticleConfigSchema = z
  .object({
    text: z.string().optional(),
    textLocales: z.record(z.string(), z.string()).optional(),
    yearMode: z.enum(['auto', 'manual']).optional(),
    year: z.number().optional(),
    linkUrl: z.string().optional(),
    linkLabel: z.string().optional(),
  })
  .transform((raw) => {
    const yearRaw = Number(raw.year)
    return {
      text: typeof raw.text === 'string' ? raw.text.trim() : '',
      textLocales: normalizeLocaleTextMap(raw.textLocales),
      yearMode: raw.yearMode === 'manual' ? 'manual' : 'auto',
      year: Number.isFinite(yearRaw) ? Math.round(yearRaw) : new Date().getFullYear(),
      linkUrl: typeof raw.linkUrl === 'string' ? raw.linkUrl.trim() : '',
      linkLabel: typeof raw.linkLabel === 'string' ? raw.linkLabel.trim() : '',
    }
  })

export function copyrightParticleDefaults() {
  return { ...defaultCopyrightConfig() }
}

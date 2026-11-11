import { z } from 'zod'

import { normalizeLocaleTextMap } from '@/core/i18n/locale-text'

import { defaultLoginConfig } from '../config'

export const loginParticleConfigSchema = z
  .object({
    welcomeNote: z.string().optional(),
    welcomeNoteLocales: z.record(z.string(), z.string()).optional(),
    showForm: z.boolean().optional(),
  })
  .transform((raw) => ({
    welcomeNote: typeof raw.welcomeNote === 'string' ? raw.welcomeNote.trim() : '',
    welcomeNoteLocales: normalizeLocaleTextMap(raw.welcomeNoteLocales),
    showForm: raw.showForm !== false,
  }))

export function loginParticleDefaults() {
  return { ...defaultLoginConfig() }
}

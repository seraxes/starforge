import { z } from 'zod'

import { parseCssColorInput } from '@/core/modules/styles'
import { normalizeLocaleTextMap } from '@/core/i18n/locale-text'

import { defaultLogoConfig } from '../config'

const cssColorSchema = z.string().superRefine((value, ctx) => {
  const trimmed = value.trim()
  if (!trimmed) return
  const parsed = parseCssColorInput(trimmed)
  if (parsed.status === 'invalid') {
    ctx.addIssue({
      code: 'custom',
      message:
        'Color must be a CSS color (hex, rgb/rgba, hsl/hsla, or named). Leave blank to inherit.',
    })
  }
})

export const logoParticleConfigSchema = z
  .object({
    mode: z.enum(['image', 'text']).optional(),
    mediaId: z.string().optional(),
    mediaUrl: z.string().optional(),
    alt: z.string().optional(),
    maxWidth: z.number().optional(),
    maxHeight: z.number().optional(),
    linkUrl: z.string().optional(),
    text: z.string().optional(),
    textLocales: z.record(z.string(), z.string()).optional(),
    fontFamily: z.string().optional(),
    fontSize: z.number().optional(),
    fontWeight: z.union([z.number(), z.string()]).optional(),
    color: cssColorSchema.optional(),
  })
  .transform((raw) => {
    const mode = raw.mode === 'text' ? 'text' : 'image'
    const colorRaw = typeof raw.color === 'string' ? raw.color.trim() : ''
    const colorParsed = parseCssColorInput(colorRaw)
    const color = colorParsed.status === 'ok' ? colorParsed.value : ''

    const maxWidth = Number(raw.maxWidth)
    const maxHeight = Number(raw.maxHeight)
    const fontSize = Number(raw.fontSize)
    const fontWeightRaw =
      typeof raw.fontWeight === 'number' || typeof raw.fontWeight === 'string'
        ? raw.fontWeight
        : ''
    const fontWeightNum = Number(fontWeightRaw)

    return {
      mode,
      mediaId: typeof raw.mediaId === 'string' ? raw.mediaId.trim() : '',
      mediaUrl: typeof raw.mediaUrl === 'string' ? raw.mediaUrl.trim() : '',
      alt: (typeof raw.alt === 'string' ? raw.alt.trim() : '') || 'Logo',
      linkUrl: typeof raw.linkUrl === 'string' ? raw.linkUrl.trim() : '',
      text: typeof raw.text === 'string' ? raw.text.trim() : '',
      textLocales: normalizeLocaleTextMap(raw.textLocales),
      fontFamily: typeof raw.fontFamily === 'string' ? raw.fontFamily.trim() : '',
      color,
      ...(Number.isFinite(maxWidth) && maxWidth > 0 ? { maxWidth: Math.round(maxWidth) } : {}),
      ...(Number.isFinite(maxHeight) && maxHeight > 0
        ? { maxHeight: Math.round(maxHeight) }
        : {}),
      ...(Number.isFinite(fontSize) && fontSize > 0 ? { fontSize: Math.round(fontSize) } : {}),
      fontWeight:
        Number.isFinite(fontWeightNum) && fontWeightNum > 0
          ? Math.round(fontWeightNum)
          : typeof fontWeightRaw === 'string' && fontWeightRaw.trim()
            ? fontWeightRaw.trim()
            : 700,
    }
  })

export function logoParticleDefaults() {
  return { ...defaultLogoConfig() }
}

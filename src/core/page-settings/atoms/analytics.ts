import type { StarforgeAtomDefinition } from '../types'

export type AnalyticsConfig = {
  /** Measurement / property id (e.g. G-XXXX or UA-XXXX). */
  measurementId?: string
  provider?: 'google' | 'generic'
}

function asConfig(raw: Record<string, unknown>): AnalyticsConfig {
  return {
    measurementId: typeof raw.measurementId === 'string' ? raw.measurementId.trim() : '',
    provider: raw.provider === 'generic' ? 'generic' : 'google',
  }
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** Atom: Google Analytics (gtag) or generic measurement id snippet. */
export const analyticsAtom: StarforgeAtomDefinition = {
  type: 'analytics',
  label: 'Analytics',
  description: 'Google Analytics (gtag) or a generic measurement id.',
  requiresDeveloperAdmin: true,
  defaultConfig: () => ({ measurementId: '', provider: 'google' }),
  inject: (raw) => {
    const config = asConfig(raw)
    const id = config.measurementId
    if (!id) return []

    if (config.provider === 'generic') {
      return [
        {
          target: 'head',
          html: `<meta name="sf-analytics-id" content="${escapeAttr(id)}" />`,
        },
      ]
    }

    const safeId = escapeAttr(id)
    return [
      {
        target: 'head',
        html: [
          `<script async src="https://www.googletagmanager.com/gtag/js?id=${safeId}"></script>`,
          `<script data-sf-atom="analytics">window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${safeId}');</script>`,
        ].join('\n'),
      },
    ]
  },
}

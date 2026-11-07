/**
 * product:pwa shared types — sf_module_settings document shape.
 */

export type PwaDisplayMode = 'standalone' | 'minimal-ui' | 'browser'

export type PwaModuleSettings = {
  shortName: string
  themeColor: string
  backgroundColor: string
  display: PwaDisplayMode
  /** Site-relative or absolute start path (locale prefix applied when relative `/`). */
  startUrl: string
  /** Optional Media library override for install icons. */
  iconMediaId: string
  iconUrl: string
}

export const PWA_DISPLAY_MODES: readonly PwaDisplayMode[] = [
  'standalone',
  'minimal-ui',
  'browser',
] as const

export const DEFAULT_PWA_MODULE_SETTINGS: PwaModuleSettings = {
  shortName: '',
  themeColor: '#0b1f33',
  backgroundColor: '#0b1f33',
  display: 'standalone',
  startUrl: '/',
  iconMediaId: '',
  iconUrl: '',
}

export type PwaAdminActionState = {
  error?: string
  ok?: boolean
  message?: string
}

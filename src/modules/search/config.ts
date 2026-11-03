import type { LayoutSlotConfig } from '@/core/modules/types'

/** Search particle settings (layout cog / defaults). */
export type SearchParticleConfig = {
  /** Optional heading above the form. */
  heading?: string
  /** Input placeholder. */
  placeholder?: string
  /** Submit button label. */
  buttonLabel?: string
}

export function defaultSearchConfig(): SearchParticleConfig {
  return {
    heading: '',
    placeholder: 'Search pages…',
    buttonLabel: 'Search',
  }
}

export function readSearchConfig(
  config: LayoutSlotConfig | undefined,
): SearchParticleConfig {
  const c = config ?? {}
  const defaults = defaultSearchConfig()
  return {
    heading: typeof c.heading === 'string' ? c.heading : defaults.heading,
    placeholder:
      typeof c.placeholder === 'string' && c.placeholder.trim()
        ? c.placeholder.trim()
        : defaults.placeholder,
    buttonLabel:
      typeof c.buttonLabel === 'string' && c.buttonLabel.trim()
        ? c.buttonLabel.trim()
        : defaults.buttonLabel,
  }
}

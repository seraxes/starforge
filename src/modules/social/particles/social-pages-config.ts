import type { LayoutSlotConfig } from '@/core/modules/types'

import {
  parseSocialParticleScopeIds,
  readSocialParticleLimit,
  readSocialParticleShowImages,
  readSocialParticleSource,
  scopeIdsToConfigValue,
  type SocialParticleSource,
} from './social-particle-scope'

export type SocialPagesParticleConfig = {
  heading: string
  emptyMessage: string
  limit: number
  /** viewer = liked; groups = scopeIds (page ids); all = directory. */
  source: SocialParticleSource
  /** Page ids when source=groups. */
  scopeIds: string[]
  showImages: boolean
}

export function defaultSocialPagesConfig(): SocialPagesParticleConfig {
  return {
    heading: 'Pages',
    emptyMessage: 'No pages yet.',
    limit: 12,
    source: 'viewer',
    scopeIds: [],
    showImages: true,
  }
}

export function readSocialPagesConfig(
  config: LayoutSlotConfig | undefined,
): SocialPagesParticleConfig {
  const defaults = defaultSocialPagesConfig()
  return {
    heading: typeof config?.heading === 'string' ? config.heading : defaults.heading,
    emptyMessage:
      typeof config?.emptyMessage === 'string' && config.emptyMessage.trim()
        ? config.emptyMessage.trim()
        : defaults.emptyMessage,
    limit: readSocialParticleLimit(config, defaults.limit),
    source: readSocialParticleSource(config, defaults.source),
    scopeIds: parseSocialParticleScopeIds(config?.scopeIds ?? config?.groupIds),
    showImages: readSocialParticleShowImages(config, defaults.showImages),
  }
}

export function socialPagesConfigToJson(cfg: SocialPagesParticleConfig): LayoutSlotConfig {
  return {
    heading: cfg.heading,
    emptyMessage: cfg.emptyMessage,
    limit: cfg.limit,
    source: cfg.source,
    scopeIds: scopeIdsToConfigValue(cfg.scopeIds),
    showImages: cfg.showImages,
  }
}

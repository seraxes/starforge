import type { LayoutSlotConfig } from '@/core/modules/types'

import {
  parseSocialParticleScopeIds,
  readSocialParticleLimit,
  readSocialParticleSource,
  scopeIdsToConfigValue,
  type SocialParticleSource,
} from './social-particle-scope'

export type SocialAlbumsParticleConfig = {
  heading: string
  emptyMessage: string
  limit: number
  /** viewer = my albums; groups = group albums (scopeIds); all = recent visible. */
  source: SocialParticleSource
  /** Group ids when source=groups (empty = viewer’s groups). */
  scopeIds: string[]
}

export function defaultSocialAlbumsConfig(): SocialAlbumsParticleConfig {
  return {
    heading: 'Albums',
    emptyMessage: 'No album images yet.',
    limit: 12,
    source: 'viewer',
    scopeIds: [],
  }
}

export function readSocialAlbumsConfig(
  config: LayoutSlotConfig | undefined,
): SocialAlbumsParticleConfig {
  const defaults = defaultSocialAlbumsConfig()
  return {
    heading: typeof config?.heading === 'string' ? config.heading : defaults.heading,
    emptyMessage:
      typeof config?.emptyMessage === 'string' && config.emptyMessage.trim()
        ? config.emptyMessage.trim()
        : defaults.emptyMessage,
    limit: readSocialParticleLimit(config, defaults.limit, 48),
    source: readSocialParticleSource(config, defaults.source),
    scopeIds: parseSocialParticleScopeIds(config?.scopeIds ?? config?.groupIds),
  }
}

export function socialAlbumsConfigToJson(cfg: SocialAlbumsParticleConfig): LayoutSlotConfig {
  return {
    heading: cfg.heading,
    emptyMessage: cfg.emptyMessage,
    limit: cfg.limit,
    source: cfg.source,
    scopeIds: scopeIdsToConfigValue(cfg.scopeIds),
  }
}

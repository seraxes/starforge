import type { LayoutSlotConfig } from '@/core/modules/types'

import {
  parseSocialParticleScopeIds,
  readSocialParticleLimit,
  readSocialParticleShowImages,
  readSocialParticleSource,
  scopeIdsToConfigValue,
  type SocialParticleSource,
} from './social-particle-scope'

export type SocialGroupsParticleConfig = {
  heading: string
  emptyMessage: string
  limit: number
  /** viewer = memberships; groups = scopeIds; all = directory. */
  source: SocialParticleSource
  /** Group ids when source=groups. */
  scopeIds: string[]
  showImages: boolean
}

export function defaultSocialGroupsConfig(): SocialGroupsParticleConfig {
  return {
    heading: 'Groups',
    emptyMessage: 'No groups yet.',
    limit: 12,
    source: 'viewer',
    scopeIds: [],
    showImages: true,
  }
}

export function readSocialGroupsConfig(
  config: LayoutSlotConfig | undefined,
): SocialGroupsParticleConfig {
  const defaults = defaultSocialGroupsConfig()
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

export function socialGroupsConfigToJson(cfg: SocialGroupsParticleConfig): LayoutSlotConfig {
  return {
    heading: cfg.heading,
    emptyMessage: cfg.emptyMessage,
    limit: cfg.limit,
    source: cfg.source,
    scopeIds: scopeIdsToConfigValue(cfg.scopeIds),
    showImages: cfg.showImages,
  }
}

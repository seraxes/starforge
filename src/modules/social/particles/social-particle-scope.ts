import type { LayoutSlotConfig } from '@/core/modules/types'

/** Who the Social layout particles read from. */
export const SOCIAL_PARTICLE_SOURCES = ['viewer', 'groups', 'all'] as const
export type SocialParticleSource = (typeof SOCIAL_PARTICLE_SOURCES)[number]

export function isSocialParticleSource(value: unknown): value is SocialParticleSource {
  return (
    typeof value === 'string' &&
    (SOCIAL_PARTICLE_SOURCES as readonly string[]).includes(value)
  )
}

/** Parse comma / whitespace separated ids. Drops blanks; keeps order; unique. */
export function parseSocialParticleScopeIds(raw: unknown): string[] {
  if (typeof raw !== 'string' && typeof raw !== 'number') return []
  const text = String(raw)
  if (!text.trim()) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of text.split(/[\s,]+/)) {
    const id = part.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function readSocialParticleSource(
  config: LayoutSlotConfig | undefined,
  fallback: SocialParticleSource = 'viewer',
): SocialParticleSource {
  const raw = config?.source
  return isSocialParticleSource(raw) ? raw : fallback
}

export function readSocialParticleShowImages(
  config: LayoutSlotConfig | undefined,
  fallback = true,
): boolean {
  const raw = config?.showImages
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true
  return fallback
}

export function readSocialParticleLimit(
  config: LayoutSlotConfig | undefined,
  fallback: number,
  max = 100,
): number {
  const raw = config?.limit
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(Math.floor(n), max)
}

export function scopeIdsToConfigValue(ids: readonly string[]): string {
  return ids.join(', ')
}

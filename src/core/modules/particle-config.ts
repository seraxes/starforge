import type { ZodType } from 'zod'

import {
  particleConfigSchemaLoaders,
  particleDefaultsLoaders,
  particleEditorLoaders,
} from '@/generated/module-registry'
import type { LayoutSlotConfig } from '@/core/modules/types'

export async function loadParticleConfigSchema(
  moduleId: string,
): Promise<ZodType | null> {
  const entry = particleConfigSchemaLoaders.find((row) => row.id === moduleId)
  if (!entry) return null
  return entry.load()
}

export async function loadParticleDefaults(
  moduleId: string,
): Promise<LayoutSlotConfig | undefined> {
  const entry = particleDefaultsLoaders.find((row) => row.id === moduleId)
  if (!entry) return undefined
  const value = await entry.load()
  return value as LayoutSlotConfig
}

export function hasParticleConfigSchema(moduleId: string): boolean {
  return particleConfigSchemaLoaders.some((row) => row.id === moduleId)
}

export function hasParticleEditor(moduleId: string): boolean {
  return particleEditorLoaders.some((row) => row.id === moduleId)
}

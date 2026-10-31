import type { ReactNode } from 'react'

import type { FeatureFlags, SiteSettingsData } from '@/core/settings/defaults'

/**
 * Named layout positions. Any registered module may target any of these —
 * no hard locks (Gantry-like rule). More IDs can be added later without
 * changing module code.
 */
export const LAYOUT_POSITIONS = ['header', 'after-content', 'footer'] as const

export type LayoutPositionId = (typeof LAYOUT_POSITIONS)[number] | (string & {})

export type ModuleRenderContext = {
  position: LayoutPositionId
  settings: SiteSettingsData
}

/**
 * A Starforge extension module — own folder under `src/modules/`, registered
 * via `registerModule`. Render into named positions from the layout document.
 */
export type StarforgeModule = {
  /** Stable id used in layout assignments (kebab-case). */
  id: string
  name: string
  description?: string
  /**
   * When set, the module only renders if this site-settings feature flag is on.
   * The global `modules` master flag is always checked by the position renderer.
   */
  featureFlag?: keyof FeatureFlags
  /** Hint for seeds / docs; the layout document is the source of truth for placement. */
  defaultPosition?: LayoutPositionId
  render: (ctx: ModuleRenderContext) => ReactNode | Promise<ReactNode>
}

/** One module instance placed in a named position (layout document entry). */
export type LayoutAssignment = {
  moduleId: string
  position: LayoutPositionId
  /** Defaults to true when omitted. */
  enabled?: boolean
  /** Lower sorts first within a position. Defaults to 0. */
  order?: number
}

/**
 * Layout document shape — today a checked-in JSON file; later the visual
 * layout editor will read/write the same structure (YAML or JSON on disk / DB).
 */
export type LayoutDocument = {
  version: 1
  assignments: LayoutAssignment[]
}

import type { ReactNode } from 'react'

import type { FeatureFlags, SiteSettingsData } from '@/core/settings/defaults'

/**
 * Built-in position ids used by the default layout seed.
 * Admins may add more ids — any registered module may target any position
 * (Gantry-like rule). No hard locks.
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

/** One module instance assigned to a named position. */
export type LayoutModuleAssignment = {
  moduleId: string
  /** Defaults to true when omitted. */
  enabled?: boolean
  /** Lower sorts first within a position. Defaults to 0. */
  order?: number
}

/**
 * Named position inside a section. Public `<ModuleSlot>` keys off `id`.
 * Within a content section, `placement` controls whether the slot renders
 * before or after SiteHeader + page children.
 */
export type LayoutPosition = {
  id: LayoutPositionId
  label: string
  order?: number
  /** Only meaningful when the parent section has `content: true`. */
  placement?: 'before' | 'after'
  modules: LayoutModuleAssignment[]
}

/**
 * A layout section groups named positions. Sections with `content: true`
 * wrap the public page chrome (SiteHeader + children).
 */
export type LayoutSection = {
  id: string
  label: string
  order?: number
  /** When true, SiteHeader + page children render in this section. */
  content?: boolean
  positions: LayoutPosition[]
}

/**
 * Canonical layout document (version 2).
 * Storage: JSON in `sf_layouts` (core DB). Seed / fallback: `default-layout.json`.
 * Visual editor (later) edits the same shape; YAML export is a future option.
 */
export type LayoutDocument = {
  version: 2
  sections: LayoutSection[]
}

/**
 * Legacy flat assignments (version 1) — still accepted when reading and
 * upgraded in-memory to version 2.
 */
export type LayoutAssignmentV1 = {
  moduleId: string
  position: LayoutPositionId
  enabled?: boolean
  order?: number
}

export type LayoutDocumentV1 = {
  version: 1
  assignments: LayoutAssignmentV1[]
}

/** @deprecated Prefer LayoutModuleAssignment — kept for call-site aliases. */
export type LayoutAssignment = LayoutModuleAssignment & { position?: LayoutPositionId }

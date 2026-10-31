import type { ReactNode } from 'react'

import type { FeatureFlags, SiteSettingsData } from '@/core/settings/defaults'

/** 12-column grid (Gantry-style). Not Bootstrap — Starforge owns the math. */
export const LAYOUT_GRID_COLUMNS = 12 as const

export type LayoutGridWidth = number

/**
 * Built-in section ids used by the default seed. Admins may add more —
 * any registered module (particle) may go in any section/slot.
 */
export const LAYOUT_POSITIONS = ['header', 'navigation', 'main', 'footer'] as const

export type LayoutPositionId = (typeof LAYOUT_POSITIONS)[number] | (string & {})

/** Per-slot particle config (Custom HTML/CSS/JS, future particle settings). */
export type LayoutSlotConfig = {
  html?: string
  css?: string
  /**
   * Custom JS source. Stored for later; execution is gated to developer-admins
   * (not run in this foundation slice).
   */
  js?: string
  title?: string
  [key: string]: unknown
}

/**
 * One particle instance in a row (Gantry “particle” / module assignment).
 * `width` is columns out of 12.
 */
export type LayoutSlot = {
  id: string
  moduleId: string
  /** Columns 1–12. Defaults to 12. */
  width: LayoutGridWidth
  enabled?: boolean
  order?: number
  config?: LayoutSlotConfig
}

/** Horizontal row of slots inside a section (sums toward 12 columns). */
export type LayoutRow = {
  id: string
  order?: number
  slots: LayoutSlot[]
}

/** Vertical section on the canvas (Header, Main, Footer, …). */
export type LayoutSection = {
  id: string
  label: string
  order?: number
  rows: LayoutRow[]
}

/**
 * Canonical layout document (version 3).
 * Storage: JSON in `sf_layouts`. Seed / fallback: `default-layout.json`.
 */
export type LayoutDocument = {
  version: 3
  sections: LayoutSection[]
}

export type ModuleRenderContext = {
  /** Section id the slot lives in (layout “position” in the Gantry sense). */
  position: LayoutPositionId
  settings: SiteSettingsData
  slot: LayoutSlot
  /** Page body for the built-in `page-content` particle. */
  pageContent?: ReactNode
}

/**
 * A Starforge extension module / particle — own folder under `src/modules/`
 * (or built-in under `src/core/modules/particles/`), registered via `registerModule`.
 */
export type StarforgeModule = {
  id: string
  name: string
  description?: string
  /**
   * Built-ins (`page-content`, `site-header`, …) always render — they are not
   * gated by the site-settings Modules master toggle.
   */
  builtin?: boolean
  featureFlag?: keyof FeatureFlags
  /** Hint for palette / seeds. */
  defaultWidth?: LayoutGridWidth
  render: (ctx: ModuleRenderContext) => ReactNode | Promise<ReactNode>
}

/* —— Legacy shapes (still accepted on read, upgraded to v3) —— */

/** @deprecated v2 position bag */
export type LayoutModuleAssignment = {
  moduleId: string
  enabled?: boolean
  order?: number
  width?: number
  config?: LayoutSlotConfig
}

/** @deprecated v2 */
export type LayoutPosition = {
  id: LayoutPositionId
  label: string
  order?: number
  placement?: 'before' | 'after'
  content?: boolean
  modules: LayoutModuleAssignment[]
}

/** @deprecated v2 section */
export type LayoutSectionV2 = {
  id: string
  label: string
  order?: number
  content?: boolean
  positions: LayoutPosition[]
}

export type LayoutDocumentV2 = {
  version: 2
  sections: LayoutSectionV2[]
}

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

/** @deprecated Prefer LayoutSlot */
export type LayoutAssignment = LayoutModuleAssignment & { position?: LayoutPositionId }

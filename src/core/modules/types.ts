import type { ReactNode } from 'react'

import type { FeatureFlags, SiteSettingsData } from '@/core/settings/defaults'

import type { LayoutContainerMode, LayoutDocumentStyles, LayoutSectionStyles } from './styles'

export type {
  LayoutBreakpoints,
  LayoutContainerMode,
  LayoutDocumentStyles,
  LayoutSectionStyles,
} from './styles'

/**
 * Slot width is an integer **percent** of the row (Gantry-style block size).
 * Not Bootstrap. Resize steps are 1%; shared-row min 5% / max 95%.
 */
export const LAYOUT_GRID_COLUMNS = 100 as const

export type LayoutGridWidth = number

/**
 * Built-in section ids used by the default seed. Admins may add more —
 * any registered module (particle) may go in any section/slot.
 */
export const LAYOUT_POSITIONS = ['header', 'navigation', 'main', 'footer'] as const

export type LayoutPositionId = (typeof LAYOUT_POSITIONS)[number] | (string & {})

/** Per-slot particle config (typed Logo/Copyright/Social fields, Custom HTML/CSS/JS, …). */
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
 * `width` is percent of the row (1% steps; min 5% when shared).
 */
export type LayoutSlot = {
  id: string
  moduleId: string
  /**
   * Optional instance display name on the canvas (editable).
   * Does not change `moduleId` / particle type. Empty → catalog name.
   */
  name?: string
  /** Percent of the row (typically 5–100). Defaults to 100. */
  width: LayoutGridWidth
  enabled?: boolean
  order?: number
  /**
   * Who can see this particle (same tokens as Nav):
   * `public` | `registered` | `group:<id>`. Match ANY; omitted / empty = public.
   * Groups are the only ACL entity; SlotRenderer filters by session.
   */
  accessTags?: string[]
  /** @deprecated Prefer `accessTags`; still read for legacy single-value slots. */
  accessLevel?: string
  config?: LayoutSlotConfig
}

/** Horizontal row of slots inside a section (widths should sum to ~100%). */
export type LayoutRow = {
  id: string
  order?: number
  slots: LayoutSlot[]
}

/** Vertical section on the canvas (Header, Main, Footer, …). */
export type LayoutSection = {
  id: string
  /** Display name on the canvas (editable; id stays stable). */
  label: string
  /**
   * Optional space-separated CSS classes applied on the public section wrapper.
   * Does not replace the built-in `sf-layout-section` class.
   */
  cssClass?: string
  /**
   * Section owns container width (SF-34): `full` = edge-to-edge, `boxed` =
   * constrained to `--sf-container-max` (outline large-desktop breakpoint).
   * Row % is share *inside* this container. Omitted → inherit Page Settings
   * sections layout default (`fullwidth` → full).
   */
  containerMode?: LayoutContainerMode
  /**
   * Gantry-like Section Styles on this instance (bg + text; image/overlay later).
   * Outline-scoped via the layout document — not a fixed Navigation/Header name list.
   */
  styles?: LayoutSectionStyles
  order?: number
  rows: LayoutRow[]
}

/**
 * Canonical layout document (version 3).
 * Storage: JSON in `sf_layouts`. Seed / fallback: `default-layout.json`.
 * `styles.breakpoints` are outline-scoped (default outline = site global).
 */
export type LayoutDocument = {
  version: 3
  sections: LayoutSection[]
  /** Outline-scoped styles (breakpoints now; accents later with theme SF-33). */
  styles?: LayoutDocumentStyles
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
 * A public (or admin) route a module exposes for Nav manager “module” links.
 * Declared on the module / catalog entry; only enabled modules appear in pickers.
 */
export type ModuleNavView = {
  /** Stable key within the module (e.g. `register`, `login`). */
  key: string
  /** Admin picker label. */
  label: string
  /** Resolved path or absolute URL. */
  href: string
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
  /** Optional navigable views for Nav manager module link type. */
  navViews?: ModuleNavView[]
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

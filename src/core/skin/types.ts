/**
 * Skin port — replaceable public front-end brand package.
 * Like a Gantry 5 theme: tokens + CSS (+ optional JS) **and** outline layout seeds
 * (Gantry YAML outlines → Starforge `LayoutDocument` JSON in `sf_layouts`).
 * Not admin chrome (`admin-theme`). Layout Styles editing stays on Layouts → Styles.
 */

import type { LayoutDocument } from '@/core/modules/types'

export type SkinId = string

export type SkinColorScheme = 'light' | 'dark'

/** CSS custom properties for the public site (`--sf-*`). */
export type SkinTokens = {
  primary: string
  primaryStrong: string
  primaryInk: string
  secondary: string
  secondaryStrong: string
  secondaryInk: string
  ink: string
  muted: string
  paper: string
  line: string
  accent: string
  accentInk: string
  fontDisplay: string
  fontBody: string
}

/**
 * One outline shipped with a Skin (Gantry `outlines/*.yaml` equivalent).
 * Prefer ids prefixed with the skin id (`starforge-pastel-default`).
 */
export type SkinOutlineSeed = {
  id: string
  label: string
  /** v3 layout document (JSON today; YAML import later). */
  document: LayoutDocument
  /** When true, overwrite an existing `sf_layouts` row on seed. Default false. */
  forceUpdate?: boolean
  /** Prefer this outline as the site default layout assignment when the skin is set. */
  defaultForSite?: boolean
}

export type Skin = {
  id: SkinId
  label: string
  /**
   * Value for `data-sf-skin` on `.public-shell`.
   * CSS and optional client hooks key off this.
   */
  dataAttr: string
  colorScheme: SkinColorScheme
  tokens: SkinTokens
  /** Outline layout seeds (installed into `sf_layouts` when the skin is set). */
  outlineSeeds?: SkinOutlineSeed[]
  /** Outline id to assign on global Page Settings when this skin becomes default. */
  preferredDefaultOutlineId?: string
}

export type SkinRegistry = Record<SkinId, Skin>

/** Persisted site default (admin Skins manager). */
export type SkinSettingsDocument = {
  defaultSkinId: string
}

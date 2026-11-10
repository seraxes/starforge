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
 * One outline shipped with a Skin (`outlines/*.yaml`).
 * Prefer ids prefixed with the skin id (`starforge-pastel-default`).
 */
export type SkinOutlineSeed = {
  id: string
  label: string
  /** v3 layout document (YAML on disk; JSONB in `sf_layouts` at runtime). */
  document: LayoutDocument
  /** When true, overwrite an existing `sf_layouts` row on seed. Default false. */
  forceUpdate?: boolean
  /** Prefer this outline as the site default layout assignment when the skin is set. */
  defaultForSite?: boolean
}

export type SkinPackSource = 'bundled' | 'installed'

export type Skin = {
  id: SkinId
  label: string
  /**
   * Legacy data-attr mirror (`data-sf-skin` on `.public-shell`).
   * Public CSS engine keys off `body.sf-skin-{id}` / `body.sf-outline-{id}`.
   */
  dataAttr: string
  colorScheme: SkinColorScheme
  tokens: SkinTokens
  /** Outline layout seeds (installed into `sf_layouts` when the skin is set). */
  outlineSeeds?: SkinOutlineSeed[]
  /** Outline id to assign on global Page Settings when this skin becomes default. */
  preferredDefaultOutlineId?: string
  /** Optional `skin.css` contents (injected at runtime). */
  cssSource?: string
  /** Absolute pack directory when loaded from disk. */
  packDir?: string
  /** Bundled (repo) vs uploaded under `data/skins`. */
  source?: SkinPackSource
}

export type SkinRegistry = Record<SkinId, Skin>

/** Persisted site default (admin Skins manager). */
export type SkinSettingsDocument = {
  defaultSkinId: string
}

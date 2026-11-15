/**
 * One deployment has one hero. Codegen reads the manifest named by
 * `starforge.modules.json` `hero` (omit means `default`) and writes
 * `ACTIVE_HERO` plus `heroBootLoader`. Modules and Core never import `@/hero`.
 */

export type HeroProfileFieldType = 'text' | 'textarea' | 'select'

export type HeroProfileField = {
  /** Stored under `extensions[heroId][key]`. Starts with a letter. */
  key: string
  label: string
  type?: HeroProfileFieldType
  /** Required when `type` is `select`. */
  options?: Array<{ value: string; label: string }>
}

/**
 * Empty means no fields, no boot, and no skin preference.
 * `skinId` must already exist in the skin registry. This stage does not load a new theme.
 * `boot` is the same shape as a pack boot declaration and must point at `@/hero/…`.
 */
export type HeroManifest = {
  id: string
  label: string
  skinId?: string
  profileFields?: HeroProfileField[]
  boot?: {
    importPath: string
    exportName: string
  }
}

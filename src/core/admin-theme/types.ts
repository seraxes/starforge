/**
 * Admin theme port — replaceable visual chrome for Core `/app/admin` + Payload `/admin`.
 * Nav IA lives in `admin-nav` (independent); themes may only style / lightly hook chrome.
 */

export type AdminThemeId = string

export type AdminThemeColorScheme = 'dark' | 'light'

/** CSS custom properties shared by Core + Payload theming. */
export type AdminThemeTokens = {
  /** Canvas / page background */
  bg: string
  bgDeep: string
  surface: string
  elevated: string
  input: string
  /** Mid-blue chrome accent (Gantry Helium bars / hover) */
  blueMid: string
  blueBorder: string
  blueAction: string
  line: string
  ink: string
  muted: string
  /** Primary actions only (Save) */
  primary: string
  primaryStrong: string
  primaryInk: string
  /** Pastel blue secondary */
  secondary: string
  secondaryStrong: string
  /** Optional chrome metrics (Core CSS may also set these on `.admin-shell`) */
  iconPrimary?: string
  iconSecondary?: string
  moduleBorderWidth?: string
  moduleBorderColor?: string
  btnPadY?: string
  btnPadX?: string
  btnFont?: string
  btnMinHeight?: string
}

export type AdminTheme = {
  id: AdminThemeId
  label: string
  /**
   * Value for `data-sf-admin-theme` on Core shell / Payload nav.
   * CSS and optional chrome hooks key off this.
   */
  dataAttr: string
  /** Preferred Payload `admin.theme` lock (`dark` for Starforge Gantry). */
  payloadColorScheme: AdminThemeColorScheme
  tokens: AdminThemeTokens
}

export type AdminThemeRegistry = Record<AdminThemeId, AdminTheme>

/**
 * Gantry-style Layouts CSS class presets (particle / section wrappers).
 * Each group is mutually exclusive — picking one replaces that group’s token in `cssClass`.
 */

export type LayoutCssPresetGroupId = 'align' | 'padding' | 'margin'

export type LayoutCssPresetOption = {
  /** Empty value = clear this group’s class. */
  value: string
  label: string
}

export type LayoutCssPresetGroup = {
  id: LayoutCssPresetGroupId
  label: string
  options: LayoutCssPresetOption[]
}

export const LAYOUT_CSS_PRESET_GROUPS: LayoutCssPresetGroup[] = [
  {
    id: 'align',
    label: 'Align',
    options: [
      { value: '', label: '— Default —' },
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
      { value: 'right', label: 'Right' },
    ],
  },
  {
    id: 'padding',
    label: 'Padding',
    options: [
      { value: '', label: '— Default —' },
      { value: 'nomarginpad', label: 'None (nomarginpad)' },
      { value: 'pad-none', label: 'None' },
      { value: 'pad-xs', label: 'XS' },
      { value: 'pad-sm', label: 'Small' },
      { value: 'pad-md', label: 'Medium' },
      { value: 'pad-lg', label: 'Large' },
      { value: 'pad-xl', label: 'XL' },
      { value: 'pad-y-sm', label: 'Vertical SM' },
      { value: 'pad-y-md', label: 'Vertical MD' },
      { value: 'pad-y-lg', label: 'Vertical LG' },
      { value: 'pad-y-xl', label: 'Vertical XL' },
      { value: 'pad-x-sm', label: 'Horizontal SM' },
      { value: 'pad-x-md', label: 'Horizontal MD' },
      { value: 'pad-x-lg', label: 'Horizontal LG' },
      { value: 'pad-x-xl', label: 'Horizontal XL' },
      { value: 'pad-top-sm', label: 'Top SM' },
      { value: 'pad-top-md', label: 'Top MD' },
      { value: 'pad-top-lg', label: 'Top LG' },
      { value: 'pad-top-xl', label: 'Top XL' },
      { value: 'pad-bottom-sm', label: 'Bottom SM' },
      { value: 'pad-bottom-md', label: 'Bottom MD' },
      { value: 'pad-bottom-lg', label: 'Bottom LG' },
      { value: 'pad-bottom-xl', label: 'Bottom XL' },
    ],
  },
  {
    id: 'margin',
    label: 'Margin',
    options: [
      { value: '', label: '— Default —' },
      { value: 'margin-none', label: 'None' },
      { value: 'margin-xs', label: 'XS' },
      { value: 'margin-sm', label: 'Small' },
      { value: 'margin-md', label: 'Medium' },
      { value: 'margin-lg', label: 'Large' },
      { value: 'margin-xl', label: 'XL' },
      { value: 'margin-y-sm', label: 'Vertical SM' },
      { value: 'margin-y-md', label: 'Vertical MD' },
      { value: 'margin-y-lg', label: 'Vertical LG' },
      { value: 'margin-y-xl', label: 'Vertical XL' },
      { value: 'margin-top-sm', label: 'Top SM' },
      { value: 'margin-top-md', label: 'Top MD' },
      { value: 'margin-top-lg', label: 'Top LG' },
      { value: 'margin-top-xl', label: 'Top XL' },
      { value: 'margin-bottom-sm', label: 'Bottom SM' },
      { value: 'margin-bottom-md', label: 'Bottom MD' },
      { value: 'margin-bottom-lg', label: 'Bottom LG' },
      { value: 'margin-bottom-xl', label: 'Bottom XL' },
      { value: 'margin-x-auto', label: 'Horizontal auto (center block)' },
    ],
  },
]

const GROUP_TOKEN_SETS: Record<LayoutCssPresetGroupId, Set<string>> = {
  align: new Set(
    LAYOUT_CSS_PRESET_GROUPS.find((g) => g.id === 'align')!.options
      .map((o) => o.value)
      .filter(Boolean),
  ),
  padding: new Set(
    LAYOUT_CSS_PRESET_GROUPS.find((g) => g.id === 'padding')!.options
      .map((o) => o.value)
      .filter(Boolean),
  ),
  margin: new Set(
    LAYOUT_CSS_PRESET_GROUPS.find((g) => g.id === 'margin')!.options
      .map((o) => o.value)
      .filter(Boolean),
  ),
}

export function splitCssClassTokens(cssClass: string | undefined | null): string[] {
  if (typeof cssClass !== 'string' || !cssClass.trim()) return []
  return cssClass.split(/\s+/).map((t) => t.trim()).filter(Boolean)
}

/** Active preset value for a group ('' when none). */
export function readPresetFromCssClass(
  cssClass: string | undefined | null,
  groupId: LayoutCssPresetGroupId,
): string {
  const tokens = splitCssClassTokens(cssClass)
  const set = GROUP_TOKEN_SETS[groupId]
  for (const token of tokens) {
    if (set.has(token)) return token
  }
  return ''
}

/** Replace this group’s token; keep custom / other-group classes. */
export function applyPresetToCssClass(
  cssClass: string | undefined | null,
  groupId: LayoutCssPresetGroupId,
  nextValue: string,
): string {
  const set = GROUP_TOKEN_SETS[groupId]
  const kept = splitCssClassTokens(cssClass).filter((t) => !set.has(t))
  const next = nextValue.trim()
  if (next) kept.push(next)
  return [...new Set(kept)].join(' ')
}

/** Custom (non-preset) tokens for the free-text CSS class field. */
export function customCssClassTokens(cssClass: string | undefined | null): string {
  const allPreset = new Set<string>([
    ...GROUP_TOKEN_SETS.align,
    ...GROUP_TOKEN_SETS.padding,
    ...GROUP_TOKEN_SETS.margin,
  ])
  return splitCssClassTokens(cssClass)
    .filter((t) => !allPreset.has(t))
    .join(' ')
}

/** Merge preset tokens + custom free-text tokens into one cssClass string. */
export function mergeCssClassFromParts(parts: {
  align: string
  padding: string
  margin: string
  custom: string
}): string {
  const tokens = [
    parts.align.trim(),
    parts.padding.trim(),
    parts.margin.trim(),
    ...splitCssClassTokens(parts.custom),
  ].filter(Boolean)
  return [...new Set(tokens)].join(' ')
}

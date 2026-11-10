import React from 'react'

import {
  DEFAULT_LAYOUT_BREAKPOINTS,
  buildOutlineBreakpointCss,
  type LayoutBreakpoints,
} from './styles'

type Props = {
  layoutId: string
  skinId: string
  breakpoints?: LayoutBreakpoints | null
}

/**
 * Emit outline-scoped CSS on `body.sf-skin-*.sf-outline-*` (outline beats skin).
 * Server component — values come from the layout document `styles.breakpoints`.
 */
export function LayoutOutlineStyles({ layoutId, skinId, breakpoints }: Props) {
  const css = buildOutlineBreakpointCss(
    layoutId || 'default',
    breakpoints ?? DEFAULT_LAYOUT_BREAKPOINTS,
    skinId,
  )
  return (
    <style
      data-sf-outline-styles={layoutId || 'default'}
      data-sf-skin-id={skinId}
      dangerouslySetInnerHTML={{ __html: css }}
    />
  )
}

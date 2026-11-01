import React from 'react'

import {
  DEFAULT_LAYOUT_BREAKPOINTS,
  buildOutlineBreakpointCss,
  type LayoutBreakpoints,
} from './styles'

type Props = {
  layoutId: string
  breakpoints?: LayoutBreakpoints | null
}

/**
 * Emit outline-scoped CSS variables + mobile-menu media query for the public shell.
 * Server component — values come from the layout document `styles.breakpoints`.
 */
export function LayoutOutlineStyles({ layoutId, breakpoints }: Props) {
  const css = buildOutlineBreakpointCss(
    layoutId || 'default',
    breakpoints ?? DEFAULT_LAYOUT_BREAKPOINTS,
  )
  return (
    <style
      data-sf-outline-styles={layoutId || 'default'}
      dangerouslySetInnerHTML={{ __html: css }}
    />
  )
}

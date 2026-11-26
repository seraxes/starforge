import React from 'react'

import {
  DEFAULT_LAYOUT_BREAKPOINTS,
  buildOutlineBodyBackgroundCss,
  buildOutlineBreakpointCss,
  buildOutlineTypographyCss,
  type LayoutBodyBackground,
  type LayoutBreakpoints,
  type LayoutTypography,
} from './styles'

type Props = {
  layoutId: string
  skinId: string
  breakpoints?: LayoutBreakpoints | null
  /** Resolved page background (media id already turned into a URL). */
  bodyBackground?: LayoutBodyBackground | null
  /** Resolved type (title/text/accent). Inherited values are already merged. */
  typography?: LayoutTypography | null
}

/**
 * Emit outline-scoped CSS on `body.sf-skin-*.sf-outline-*` (outline beats skin).
 * Server component — breakpoints, page background, and type come from the layout document.
 */
export function LayoutOutlineStyles({
  layoutId,
  skinId,
  breakpoints,
  bodyBackground,
  typography,
}: Props) {
  const css = [
    buildOutlineBreakpointCss(
      layoutId || 'default',
      breakpoints ?? DEFAULT_LAYOUT_BREAKPOINTS,
      skinId,
    ),
    buildOutlineBodyBackgroundCss(layoutId || 'default', skinId, bodyBackground),
    buildOutlineTypographyCss(layoutId || 'default', skinId, typography),
  ]
    .filter(Boolean)
    .join('')
  return (
    <style
      data-sf-outline-styles={layoutId || 'default'}
      data-sf-skin-id={skinId}
      dangerouslySetInnerHTML={{ __html: css }}
    />
  )
}

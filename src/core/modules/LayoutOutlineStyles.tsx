import React from 'react'

import {
  DEFAULT_LAYOUT_BREAKPOINTS,
  buildOutlineBodyBackgroundCss,
  buildOutlineBreakpointCss,
  type LayoutBodyBackground,
  type LayoutBreakpoints,
} from './styles'

type Props = {
  layoutId: string
  skinId: string
  breakpoints?: LayoutBreakpoints | null
  /** Resolved page background (media id already turned into a URL). */
  bodyBackground?: LayoutBodyBackground | null
}

/**
 * Emit outline-scoped CSS on `body.sf-skin-*.sf-outline-*` (outline beats skin).
 * Server component — breakpoints and page background come from the layout document.
 */
export function LayoutOutlineStyles({
  layoutId,
  skinId,
  breakpoints,
  bodyBackground,
}: Props) {
  const css = [
    buildOutlineBreakpointCss(
      layoutId || 'default',
      breakpoints ?? DEFAULT_LAYOUT_BREAKPOINTS,
      skinId,
    ),
    buildOutlineBodyBackgroundCss(layoutId || 'default', skinId, bodyBackground),
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

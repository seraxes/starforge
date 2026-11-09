import React from 'react'

import { buildSkinRootCss } from './css-vars'
import { getActiveSkin } from './resolve-active'

/**
 * Injects active Skin tokens (+ optional pack skin.css) for the public site.
 * Mount only under the public locale layout (not Core admin).
 */
export async function SkinRootStyles() {
  const skin = await getActiveSkin()
  const tokenCss = buildSkinRootCss(skin.tokens)
  const extra = skin.cssSource?.trim()
  const css = extra ? `${tokenCss}\n${extra}` : tokenCss
  return (
    <style
      data-sf-skin-tokens={skin.dataAttr}
      dangerouslySetInnerHTML={{ __html: css }}
    />
  )
}

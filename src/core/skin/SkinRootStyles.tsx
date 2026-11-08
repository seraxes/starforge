import React from 'react'

import { buildSkinRootCss } from './css-vars'
import { getActiveSkin } from './resolve-active'

/**
 * Injects active Skin tokens onto `:root` for the public site.
 * Mount only under the public locale layout (not Core admin).
 */
export async function SkinRootStyles() {
  const skin = await getActiveSkin()
  const css = buildSkinRootCss(skin.tokens)
  return (
    <style
      data-sf-skin-tokens={skin.dataAttr}
      dangerouslySetInnerHTML={{ __html: css }}
    />
  )
}

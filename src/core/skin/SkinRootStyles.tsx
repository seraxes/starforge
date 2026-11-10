import React from 'react'

import { skinBodyClass } from './css-scope'
import { buildSkinRootCss } from './css-vars'
import { getActiveSkin } from './resolve-active'

/**
 * Injects active Skin tokens (+ optional pack skin.css) for the public site.
 * Scoped to `body.sf-skin-{id}` — mount only under the public locale layout.
 */
export async function SkinRootStyles() {
  const skin = await getActiveSkin()
  const tokenCss = buildSkinRootCss(skin.id, skin.tokens)
  const extra = skin.cssSource?.trim()
  const css = extra ? `${tokenCss}\n${extra}` : tokenCss
  return (
    <style
      data-sf-skin-tokens={skin.dataAttr}
      data-sf-skin-body-class={skinBodyClass(skin.id)}
      dangerouslySetInnerHTML={{ __html: css }}
    />
  )
}

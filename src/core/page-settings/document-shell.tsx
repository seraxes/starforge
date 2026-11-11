import React from 'react'
import Script from 'next/script'

import { ensureAtomsRegistered, getRegisteredAtom } from './atoms'
import { BodyAttributesClientImpl } from './body-attributes-client'
import { resolveFontAwesomeEmit } from './font-awesome'
import { HtmlInjectorClient } from './html-injector-client'
import { sortAssetsByPriority } from './merge'
import type { AtomInjectResult, ResolvedPageChrome } from './types'

export { parseBodyTagAttributes } from './parse-body-attrs'

function metaAttrName(nameOrProperty: string): { name?: string; property?: string } {
  const key = nameOrProperty.trim()
  if (!key) return {}
  if (key.includes(':') || key.startsWith('og:') || key.startsWith('twitter:')) {
    return { property: key }
  }
  return { name: key }
}

/** Prevent `</style>` in author CSS from breaking out of the style element. */
function escapeStyleText(css: string): string {
  return css.replace(/<\/style/gi, '<\\/style')
}

async function collectAtomInjects(chrome: ResolvedPageChrome): Promise<AtomInjectResult[]> {
  await ensureAtomsRegistered()
  const { MODULE_IDS, getSiteSettings, isAtomModuleEnabled, isCatalogModuleEnabled } =
    await import('@/core/settings')
  const settings = await getSiteSettings()
  const consentGate = isCatalogModuleEnabled(settings, MODULE_IDS.consent)
  const results: AtomInjectResult[] = []
  for (const atom of chrome.atoms) {
    if (!atom.enabled) continue
    if (!isAtomModuleEnabled(settings, atom.type)) continue
    const def = getRegisteredAtom(atom.type)
    if (!def) continue
    const config: Record<string, unknown> = { ...(atom.config ?? {}) }
    // product:consent — analytics scripts wait for sf-consent.analytics.
    if (consentGate && atom.type === 'analytics') {
      config.consentGate = true
    }
    results.push(...def.inject(config))
  }
  return results
}

/**
 * Head chrome: meta tags, icons, ordered CSS, FA links, atom head HTML, custom head.
 * Structured tags render as React elements; free HTML uses a client injector
 * so `<script>` nodes execute.
 */
export async function DocumentHeadChrome({ chrome }: { chrome: ResolvedPageChrome }) {
  const fa = resolveFontAwesomeEmit(chrome)
  const atomInjects = (await collectAtomInjects(chrome)).filter((i) => i.target === 'head')

  return (
    <>
      {chrome.metaTags.map((tag) => {
        const attrs = metaAttrName(tag.nameOrProperty)
        if (!attrs.name && !attrs.property) return null
        return <meta key={tag.id} {...attrs} content={tag.content} />
      })}

      {chrome.faviconUrl ? <link rel="icon" href={chrome.faviconUrl} /> : null}
      {chrome.touchIconUrl ? <link rel="apple-touch-icon" href={chrome.touchIconUrl} /> : null}

      {sortAssetsByPriority(chrome.css).map((asset) => {
        const content = asset.content?.trim() ?? ''
        const url = asset.url.trim()
        if (content) {
          // Native <style> (SSR + body-safe) — do not rely on client head injection.
          return (
            <style
              key={asset.id}
              data-sf-css={asset.name || asset.id}
              data-sf-priority={asset.priority ?? 0}
              dangerouslySetInnerHTML={{ __html: escapeStyleText(content) }}
            />
          )
        }
        if (!url) return null
        return (
          <link
            key={asset.id}
            rel="stylesheet"
            href={url}
            data-sf-css={asset.name || asset.id}
            data-sf-priority={String(asset.priority ?? 0)}
          />
        )
      })}

      {fa?.linkHrefs.map((href) => (
        <link key={href} rel="stylesheet" href={href} data-sf-font-awesome="" />
      ))}

      {fa?.cssLinkHtml ? (
        <HtmlInjectorClient html={fa.cssLinkHtml} target="head" marker="fa-css" />
      ) : null}

      {atomInjects.map((inject, index) => (
        <React.Fragment key={`atom-head-${index}`}>
          {inject.cssUrls?.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          {inject.html ? (
            // Prefer native <style> for atom CSS (same SSR path as Assets CSS).
            // Scripts / mixed HTML still use the client injector.
            /^\s*<style[\s>]/i.test(inject.html) &&
            /<\/style>\s*$/i.test(inject.html) ? (
              <style
                data-sf-atom-css=""
                dangerouslySetInnerHTML={{
                  __html: escapeStyleText(
                    inject.html.replace(/^\s*<style[^>]*>/i, '').replace(/<\/style>\s*$/i, ''),
                  ),
                }}
              />
            ) : (
              <HtmlInjectorClient html={inject.html} target="head" marker={`atom-head-${index}`} />
            )
          ) : null}
        </React.Fragment>
      ))}

      {chrome.customHeadHtml.trim() ? (
        <HtmlInjectorClient html={chrome.customHeadHtml} target="head" marker="custom-head" />
      ) : null}
    </>
  )
}

/**
 * After `<body>` open + before `</body>` close: hooks, FA JS override, ordered scripts, atoms.
 */
export async function DocumentBodyChrome({
  chrome,
  position,
}: {
  chrome: ResolvedPageChrome
  position: 'start' | 'end'
}) {
  const fa = resolveFontAwesomeEmit(chrome)
  const atomInjects = (await collectAtomInjects(chrome)).filter((i) =>
    position === 'start' ? i.target === 'body-start' : i.target === 'body-end',
  )

  if (position === 'start') {
    return (
      <>
        {chrome.afterBodyHtml.trim() ? (
          <HtmlInjectorClient html={chrome.afterBodyHtml} target="body" marker="after-body" />
        ) : null}
        {atomInjects.map((inject, index) =>
          inject.html ? (
            <HtmlInjectorClient
              key={`atom-start-${index}`}
              html={inject.html}
              target="body"
              marker={`atom-start-${index}`}
            />
          ) : null,
        )}
      </>
    )
  }

  return (
    <>
      {atomInjects.map((inject, index) => (
        <React.Fragment key={`atom-end-${index}`}>
          {inject.scriptUrls?.map((src) => (
            <Script key={src} src={src} strategy="afterInteractive" />
          ))}
          {inject.html ? (
            <HtmlInjectorClient html={inject.html} target="body" marker={`atom-end-${index}`} />
          ) : null}
        </React.Fragment>
      ))}

      {fa?.jsScriptHtml ? (
        <HtmlInjectorClient html={fa.jsScriptHtml} target="body" marker="fa-js" />
      ) : null}

      {sortAssetsByPriority(chrome.javascript).map((asset) => {
        const content = asset.content?.trim() ?? ''
        const url = asset.url.trim()
        if (content) {
          return (
            <HtmlInjectorClient
              key={asset.id}
              html={`<script data-sf-js="${asset.name || asset.id}" data-sf-priority="${asset.priority ?? 0}">${content}</script>`}
              target="body"
              marker={`js-${asset.id}`}
            />
          )
        }
        if (!url) return null
        return <Script key={asset.id} src={url} strategy="afterInteractive" />
      })}

      {chrome.beforeBodyCloseHtml.trim() ? (
        <HtmlInjectorClient
          html={chrome.beforeBodyCloseHtml}
          target="body"
          marker="before-body-close"
        />
      ) : null}
    </>
  )
}

/** @deprecated Prefer HtmlInjectorClient for executable HTML. */
export function RawHtmlSlot({
  html,
  ...rest
}: { html: string } & React.HTMLAttributes<HTMLDivElement>) {
  if (!html.trim()) return null
  return (
    <div
      {...rest}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ display: 'contents' }}
    />
  )
}

/** Apply body id / classes / tag attrs + skin/outline/sections layout classes. */
export function BodyAttributesApplier({
  bodyId,
  bodyClasses,
  bodyTagAttributes,
  sectionsLayout,
  skinId,
  outlineId,
}: {
  bodyId: string
  bodyClasses: string
  bodyTagAttributes: string
  sectionsLayout: ResolvedPageChrome['sectionsLayout']
  skinId: string
  outlineId: string
}) {
  return (
    <BodyAttributesClientImpl
      bodyId={bodyId}
      bodyClasses={bodyClasses}
      bodyTagAttributes={bodyTagAttributes}
      sectionsLayout={sectionsLayout}
      skinId={skinId}
      outlineId={outlineId}
    />
  )
}

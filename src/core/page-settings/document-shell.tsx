import React from 'react'
import Script from 'next/script'

import { ensureAtomsRegistered, getRegisteredAtom } from './atoms'
import { BodyAttributesClientImpl } from './body-attributes-client'
import { resolveFontAwesomeEmit } from './font-awesome'
import { HtmlInjectorClient } from './html-injector-client'
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

function collectAtomInjects(chrome: ResolvedPageChrome): AtomInjectResult[] {
  ensureAtomsRegistered()
  const results: AtomInjectResult[] = []
  for (const atom of chrome.atoms) {
    if (!atom.enabled) continue
    const def = getRegisteredAtom(atom.type)
    if (!def) continue
    results.push(...def.inject(atom.config ?? {}))
  }
  return results
}

/**
 * Head chrome: meta tags, icons, ordered CSS, FA links, atom head HTML, custom head.
 * Structured tags render as React elements; free HTML uses a client injector
 * so `<script>` nodes execute.
 */
export function DocumentHeadChrome({ chrome }: { chrome: ResolvedPageChrome }) {
  const fa = resolveFontAwesomeEmit(chrome)
  const atomInjects = collectAtomInjects(chrome).filter((i) => i.target === 'head')

  return (
    <>
      {chrome.metaTags.map((tag) => {
        const attrs = metaAttrName(tag.nameOrProperty)
        if (!attrs.name && !attrs.property) return null
        return <meta key={tag.id} {...attrs} content={tag.content} />
      })}

      {chrome.faviconUrl ? <link rel="icon" href={chrome.faviconUrl} /> : null}
      {chrome.touchIconUrl ? <link rel="apple-touch-icon" href={chrome.touchIconUrl} /> : null}

      {chrome.css
        .filter((asset) => asset.url.trim())
        .map((asset) => (
          <link
            key={asset.id}
            rel="stylesheet"
            href={asset.url}
            data-sf-css={asset.name || asset.id}
          />
        ))}

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
            <HtmlInjectorClient html={inject.html} target="head" marker={`atom-head-${index}`} />
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
export function DocumentBodyChrome({
  chrome,
  position,
}: {
  chrome: ResolvedPageChrome
  position: 'start' | 'end'
}) {
  const fa = resolveFontAwesomeEmit(chrome)
  const atomInjects = collectAtomInjects(chrome).filter((i) =>
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

      {chrome.javascript
        .filter((asset) => asset.url.trim())
        .map((asset) => (
          <Script key={asset.id} src={asset.url} strategy="afterInteractive" />
        ))}

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

/** Apply body id / classes / tag attrs + sections layout class. */
export function BodyAttributesApplier({
  bodyId,
  bodyClasses,
  bodyTagAttributes,
  sectionsLayout,
}: {
  bodyId: string
  bodyClasses: string
  bodyTagAttributes: string
  sectionsLayout: ResolvedPageChrome['sectionsLayout']
}) {
  return (
    <BodyAttributesClientImpl
      bodyId={bodyId}
      bodyClasses={bodyClasses}
      bodyTagAttributes={bodyTagAttributes}
      sectionsLayout={sectionsLayout}
    />
  )
}

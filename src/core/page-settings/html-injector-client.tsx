'use client'

import { useEffect, useId } from 'react'

type Props = {
  html: string
  /** Where to mount parsed nodes. */
  target: 'head' | 'body'
  /** Stable key for cleanup. */
  marker?: string
}

/**
 * Inject admin-authored HTML so `<script>` tags actually execute
 * (innerHTML alone does not run scripts).
 */
export function HtmlInjectorClient({ html, target, marker }: Props) {
  const reactId = useId()
  const mark = marker || reactId

  useEffect(() => {
    const trimmed = html.trim()
    if (!trimmed) return

    const host = target === 'head' ? document.head : document.body
    const mounted: ChildNode[] = []
    const attr = 'data-sf-html-inject'
    // Clear prior nodes for this marker (Strict Mode remount).
    const escaped =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(mark)
        : mark.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    host.querySelectorAll(`[${attr}="${escaped}"]`).forEach((node) => node.remove())

    const template = document.createElement('template')
    template.innerHTML = trimmed

    const appendNode = (node: ChildNode) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim()
        if (!text) return
        const span = document.createElement('span')
        span.setAttribute(attr, mark)
        span.hidden = true
        span.textContent = text
        host.appendChild(span)
        mounted.push(span)
        return
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return
      const el = node as Element

      if (el.tagName === 'SCRIPT') {
        const script = document.createElement('script')
        for (const a of Array.from(el.attributes)) {
          script.setAttribute(a.name, a.value)
        }
        script.text = el.textContent || ''
        script.setAttribute(attr, mark)
        host.appendChild(script)
        mounted.push(script)
        return
      }

      const clone = el.cloneNode(true) as Element
      clone.setAttribute(attr, mark)
      host.appendChild(clone)
      mounted.push(clone)
    }

    Array.from(template.content.childNodes).forEach(appendNode)

    return () => {
      for (const node of mounted) {
        node.parentNode?.removeChild(node)
      }
    }
  }, [html, target, mark])

  return null
}

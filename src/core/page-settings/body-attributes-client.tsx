'use client'

import { useEffect } from 'react'

import { parseBodyTagAttributes } from './parse-body-attrs'
import type { SectionsLayoutMode } from './types'

type Props = {
  bodyId: string
  bodyClasses: string
  bodyTagAttributes: string
  sectionsLayout: SectionsLayoutMode
}

/**
 * Apply Page Settings body id/classes/attrs + sections layout class on `document.body`.
 * Root layout owns `<body>`; public chrome cannot set those props directly.
 */
export function BodyAttributesClientImpl({
  bodyId,
  bodyClasses,
  bodyTagAttributes,
  sectionsLayout,
}: Props) {
  useEffect(() => {
    const body = document.body
    const prevId = body.id
    const layoutClass =
      sectionsLayout === 'boxed' ? 'sf-sections-boxed' : 'sf-sections-fullwidth'
    const classTokens = bodyClasses
      .split(/\s+/)
      .map((c) => c.trim())
      .filter(Boolean)
    const extraAttrs = parseBodyTagAttributes(bodyTagAttributes)
    const appliedAttrNames: string[] = []

    if (bodyId) body.id = bodyId
    body.classList.add(layoutClass, ...classTokens)

    for (const [name, value] of Object.entries(extraAttrs)) {
      body.setAttribute(name, value)
      appliedAttrNames.push(name)
    }

    return () => {
      if (bodyId) body.id = prevId
      body.classList.remove(layoutClass, ...classTokens)
      for (const name of appliedAttrNames) {
        body.removeAttribute(name)
      }
    }
  }, [bodyId, bodyClasses, bodyTagAttributes, sectionsLayout])

  return null
}

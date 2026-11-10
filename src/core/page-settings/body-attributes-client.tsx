'use client'

import { useLayoutEffect } from 'react'

import { outlineBodyClass, skinBodyClass } from '@/core/skin/css-scope'

import { parseBodyTagAttributes } from './parse-body-attrs'
import type { SectionsLayoutMode } from './types'

type Props = {
  bodyId: string
  bodyClasses: string
  bodyTagAttributes: string
  sectionsLayout: SectionsLayoutMode
  /** Active skin id → `sf-skin-{id}` on body. */
  skinId: string
  /** Resolved outline id → `sf-outline-{id}` on body. */
  outlineId: string
}

const SKIN_CLASS_RE = /^sf-skin-/
const OUTLINE_CLASS_RE = /^sf-outline-/
const SECTIONS_CLASS_RE = /^sf-sections-/

function applyBodyScope(opts: {
  bodyId: string
  bodyClasses: string
  bodyTagAttributes: string
  sectionsLayout: SectionsLayoutMode
  skinId: string
  outlineId: string
}): () => void {
  const body = document.body
  const prevId = body.id
  const layoutClass =
    opts.sectionsLayout === 'boxed' ? 'sf-sections-boxed' : 'sf-sections-fullwidth'
  const skinClass = skinBodyClass(opts.skinId)
  const outlineClass = outlineBodyClass(opts.outlineId)
  const classTokens = opts.bodyClasses
    .split(/\s+/)
    .map((c) => c.trim())
    .filter(Boolean)
  const extraAttrs = parseBodyTagAttributes(opts.bodyTagAttributes)
  const appliedAttrNames: string[] = []

  const stale: string[] = []
  body.classList.forEach((name) => {
    if (SKIN_CLASS_RE.test(name) || OUTLINE_CLASS_RE.test(name) || SECTIONS_CLASS_RE.test(name)) {
      stale.push(name)
    }
  })
  if (stale.length) body.classList.remove(...stale)

  if (opts.bodyId) body.id = opts.bodyId
  body.classList.add(skinClass, outlineClass, layoutClass, ...classTokens)

  for (const [name, value] of Object.entries(extraAttrs)) {
    body.setAttribute(name, value)
    appliedAttrNames.push(name)
  }

  return () => {
    if (opts.bodyId) body.id = prevId
    body.classList.remove(skinClass, outlineClass, layoutClass, ...classTokens)
    for (const name of appliedAttrNames) {
      body.removeAttribute(name)
    }
  }
}

/**
 * Apply Page Settings body id/classes/attrs + skin/outline/sections classes on `document.body`.
 * Root layout owns `<body>`; public chrome cannot set those props directly.
 * Skin CSS engine: `body.sf-skin-*` → `body.sf-skin-*.sf-outline-*` (outline wins).
 *
 * Inline script stamps classes before paint; useLayoutEffect keeps them in sync on navigation.
 */
export function BodyAttributesClientImpl({
  bodyId,
  bodyClasses,
  bodyTagAttributes,
  sectionsLayout,
  skinId,
  outlineId,
}: Props) {
  useLayoutEffect(() => {
    return applyBodyScope({
      bodyId,
      bodyClasses,
      bodyTagAttributes,
      sectionsLayout,
      skinId,
      outlineId,
    })
  }, [bodyId, bodyClasses, bodyTagAttributes, sectionsLayout, skinId, outlineId])

  return null
}

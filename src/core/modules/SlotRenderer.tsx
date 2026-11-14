import React from 'react'

import { getAccessViewer } from '@/core/acl/access'
import { canSeeNavAccessTags, resolveAccessTags } from '@/core/acl/nav-access'
import { HtmlInjectorClient } from '@/core/page-settings/html-injector-client'
import { getSiteSettings, isParticleModuleEnabled } from '@/core/settings'
import { ensureModulesRegistered } from '@/core/modules/boot'

import { getRegisteredModule } from './registry'
import type { LayoutPositionId, LayoutSlot } from './types'

/** Prevent `</style>` in author CSS from breaking out of the style element. */
function escapeStyleText(css: string): string {
  return css.replace(/<\/style/gi, '<\\/style')
}

type Props = {
  sectionId: LayoutPositionId
  slot: LayoutSlot
  pageContent?: React.ReactNode
  /** Active outline id for content-locale keys. */
  layoutId?: string
}

/**
 * Renders one layout slot (particle) inside a grid cell.
 * Site Settings → Modules per-id toggles gate public render (required chrome always on).
 * Slot `accessTags` (public / registered / group:<id>) filter viewing like Nav (ANY match).
 */
export async function SlotRenderer({ sectionId, slot, pageContent, layoutId }: Props) {
  if (slot.enabled === false) return null

  await ensureModulesRegistered()
  const mod = getRegisteredModule(slot.moduleId)
  if (!mod) return null

  const settings = await getSiteSettings()
  if (
    !isParticleModuleEnabled(settings, mod.id, {
      builtin: mod.builtin,
      featureFlag: mod.featureFlag,
    })
  ) {
    return null
  }
  if (mod.featureFlag && mod.featureFlag !== 'modules' && !settings.features[mod.featureFlag]) {
    return null
  }
  // Core Form also requires the product:forms capability.
  if (mod.id === 'form') {
    const { MODULE_IDS, isCatalogModuleEnabled } = await import('@/core/settings')
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) return null
  }
  // Search particle requires product:search.
  if (mod.id === 'search') {
    const { MODULE_IDS, isCatalogModuleEnabled } = await import('@/core/settings')
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.search)) return null
  }
  // event-list / event-detail / event-countdown particles require product:events.
  if (
    mod.id === 'event-list' ||
    mod.id === 'event-detail' ||
    mod.id === 'event-countdown'
  ) {
    const { MODULE_IDS, isCatalogModuleEnabled } = await import('@/core/settings')
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) return null
  }

  const accessTags = resolveAccessTags({
    accessTags: slot.accessTags,
    accessLevel: slot.accessLevel,
  })
  // Viewing filter — same multi-tag OR match as Nav (SF-45).
  if (!(accessTags.length === 1 && accessTags[0] === 'public')) {
    const viewer = await getAccessViewer()
    if (!canSeeNavAccessTags(accessTags, viewer)) return null
  }

  const rendered = await mod.render({
    position: sectionId,
    settings,
    slot,
    pageContent,
    layoutId,
  })
  if (rendered == null || rendered === false) return null

  const extraClass = typeof slot.cssClass === 'string' ? slot.cssClass.trim() : ''
  const className = ['sf-grid-col', extraClass].filter(Boolean).join(' ')
  const htmlId = typeof slot.htmlId === 'string' ? slot.htmlId.trim() : ''
  const particleCss =
    typeof slot.particleCss === 'string' ? slot.particleCss.trim() : ''
  const particleJs =
    typeof slot.particleJs === 'string' ? slot.particleJs.trim() : ''

  return (
    <div
      id={htmlId || undefined}
      className={className}
      data-sf-slot={slot.id}
      data-sf-module={slot.moduleId}
      data-sf-width={slot.width}
      data-sf-access={accessTags.join('|')}
    >
      {particleCss ? (
        <style
          data-sf-particle-css={slot.id}
          dangerouslySetInnerHTML={{ __html: escapeStyleText(particleCss) }}
        />
      ) : null}
      {rendered}
      {particleJs ? (
        <HtmlInjectorClient
          html={`<script data-sf-particle-js="${slot.id}">${particleJs}</script>`}
          target="body"
          marker={`particle-js-${slot.id}`}
        />
      ) : null}
    </div>
  )
}

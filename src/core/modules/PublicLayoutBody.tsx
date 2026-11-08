import React from 'react'

import type { NavItem } from '@/core/settings/defaults'
import { ensureModulesRegistered } from '@/core/modules/boot'
import { getActiveSkin } from '@/core/skin/resolve-active'

import { resolveMediaById } from '@/core/media/resolve'

import { LayoutOutlineStyles } from './LayoutOutlineStyles'
import { clampGridWidth, gridColStyle, LAYOUT_WIDTH_FULL } from './grid'
import { getLayoutDocument } from './layout'
import { isFooterLayoutSection, partitionSectionsForPublicPaint } from './section-order'

import {
  DEFAULT_LAYOUT_BREAKPOINTS,
  buildSectionInlineStyle,
  resolveSectionContainerMode,
  type LayoutContainerMode,
  type LayoutSectionStyles,
} from './styles'
import { SlotRenderer } from './SlotRenderer'
import type { LayoutRow, LayoutSection } from './types'

async function stylesWithResolvedBackground(
  styles: LayoutSectionStyles | undefined,
): Promise<LayoutSectionStyles | undefined> {
  if (!styles?.backgroundMediaId) return styles
  const resolved = await resolveMediaById(styles.backgroundMediaId, {
    size: 'large',
    preferWebp: true,
  })
  if (!resolved?.url) return styles
  return { ...styles, backgroundImage: resolved.url }
}

type Props = {
  children: React.ReactNode
  siteName: string
  primaryNav: NavItem[]
  /** Page Settings layout assignment (`sf_layouts` id). */
  layoutId?: string
  /**
   * Page-level default when a section omits `containerMode`.
   * Section Settings own width; this is inheritance only (SF-34).
   */
  sectionsLayout?: 'fullwidth' | 'boxed'
  /**
   * When false (Site Settings → Modules: Layout manager off), skip the full
   * layout document and render a minimal page-content shell.
   */
  layoutManagerEnabled?: boolean
}

function sortByOrder<T extends { order?: number; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
}

function sectionWrapperClass(section: LayoutSection, base: string): string {
  const extra = typeof section.cssClass === 'string' ? section.cssClass.trim() : ''
  return extra ? `${base} ${extra}` : base
}

async function SectionBlock({
  section,
  pageContent,
  pageDefault,
}: {
  section: LayoutSection
  pageContent: React.ReactNode
  pageDefault: 'fullwidth' | 'boxed'
}) {
  const rows = sortByOrder(section.rows)
  const isFooter = isFooterLayoutSection(section)
  const containerMode: LayoutContainerMode = resolveSectionContainerMode(
    section.containerMode,
    pageDefault,
  )
  const resolvedStyles = await stylesWithResolvedBackground(section.styles)
  const sectionStyle = buildSectionInlineStyle(resolvedStyles)
  const overlayOn = resolvedStyles?.backgroundOverlay === 'enabled'

  const inner = (
    <>
      {rows.map((row) => (
        <LayoutRowView key={row.id} sectionId={section.id} row={row} pageContent={pageContent} />
      ))}
    </>
  )

  const width = clampGridWidth(section.width ?? LAYOUT_WIDTH_FULL, LAYOUT_WIDTH_FULL)
  const widthStyle = gridColStyle(width)
  const mergedStyle = sectionStyle ? { ...sectionStyle, ...widthStyle } : widthStyle

  if (isFooter) {
    return (
      <footer
        className={sectionWrapperClass(section, 'site-footer sf-layout-section')}
        data-sf-section={section.id}
        data-sf-container={containerMode}
        data-sf-width={width}
        data-sf-section-styled={sectionStyle ? 'true' : undefined}
        data-sf-overlay={overlayOn ? 'enabled' : undefined}
        style={mergedStyle}
      >
        {inner}
      </footer>
    )
  }

  return (
    <section
      className={sectionWrapperClass(section, 'sf-layout-section')}
      data-sf-section={section.id}
      data-sf-container={containerMode}
      data-sf-width={width}
      data-sf-section-styled={sectionStyle ? 'true' : undefined}
      data-sf-overlay={overlayOn ? 'enabled' : undefined}
      style={mergedStyle}
    >
      {inner}
    </section>
  )
}

/** Group consecutive partial-width sections so they sit side-by-side (particle-like %). */
function chunkSectionsForMosaic(sections: LayoutSection[]): Array<
  | { kind: 'single'; section: LayoutSection }
  | { kind: 'mosaic'; sections: LayoutSection[] }
> {
  const out: Array<
    | { kind: 'single'; section: LayoutSection }
    | { kind: 'mosaic'; sections: LayoutSection[] }
  > = []
  let partialBuf: LayoutSection[] = []
  const flushPartial = () => {
    if (partialBuf.length === 0) return
    if (partialBuf.length === 1) {
      out.push({ kind: 'single', section: partialBuf[0]! })
    } else {
      out.push({ kind: 'mosaic', sections: partialBuf })
    }
    partialBuf = []
  }
  for (const section of sections) {
    const width = clampGridWidth(section.width ?? LAYOUT_WIDTH_FULL, LAYOUT_WIDTH_FULL)
    if (width < LAYOUT_WIDTH_FULL) {
      partialBuf.push(section)
      continue
    }
    flushPartial()
    out.push({ kind: 'single', section })
  }
  flushPartial()
  return out
}

function LayoutRowView({
  sectionId,
  row,
  pageContent,
}: {
  sectionId: string
  row: LayoutRow
  pageContent: React.ReactNode
}) {
  const slots = sortByOrder(row.slots)
  // Skip empty drop rows on the public site (admin opens them with + row).
  if (slots.length === 0) return null
  return (
    <div className="sf-grid-row" data-sf-row={row.id}>
      {slots.map((slot) => (
        <SlotRenderer
          key={slot.id}
          sectionId={sectionId}
          slot={slot}
          pageContent={pageContent}
        />
      ))}
    </div>
  )
}

function documentHasPageContent(sections: LayoutSection[]): boolean {
  return sections.some((s) =>
    s.rows.some((r) => r.slots.some((slot) => slot.moduleId === 'page-content' && slot.enabled !== false)),
  )
}

/**
 * Public site body driven by the layout document (sections → rows → slots).
 * Page route children render via the built-in `page-content` particle.
 *
 * `.public-shell` is the Gantry-like page-surround: header/content/footer in
 * one flex column that fills `body > main` (html/body min-height 100dvh).
 * No nested `#sf-page-surround` unless body stretch later proves insufficient.
 *
 * Section canvas order is user `order` (DnD). Public paint only moves
 * footer-named sections to the end so Main particles stay above `<footer>` —
 * stored orders are not rewritten.
 *
 * Section `containerMode` owns full vs boxed width; row % is share inside.
 * Section `width` (5–100%) spans the page mosaic — consecutive partial widths sit side-by-side.
 */
export async function PublicLayoutBody({
  children,
  siteName,
  primaryNav,
  layoutId,
  sectionsLayout = 'fullwidth',
  layoutManagerEnabled = true,
}: Props) {
  await ensureModulesRegistered()
  const skin = await getActiveSkin()
  const resolvedLayoutId = layoutId || 'default'
  const shellClass = [
    'public-shell',
    sectionsLayout === 'boxed' ? 'sf-sections-boxed' : 'sf-sections-fullwidth',
  ].join(' ')

  if (!layoutManagerEnabled) {
    const { SiteHeader } = await import('@/components/SiteHeader')
    const { getEnabledPublicLocaleEntries } = await import('@/core/i18n/enabled')
    const localesEnabled = await getEnabledPublicLocaleEntries()
    const fallbackMode = resolveSectionContainerMode(undefined, sectionsLayout)
    return (
      <div
        className={shellClass}
        data-sf-skin={skin.dataAttr}
        data-sf-layout-id="minimal"
        data-sf-sections-layout={sectionsLayout}
        data-sf-mobile-menu="collapse"
      >
        <LayoutOutlineStyles layoutId="minimal" breakpoints={DEFAULT_LAYOUT_BREAKPOINTS} />
        <SiteHeader
          siteName={siteName}
          primaryNav={primaryNav}
          localesEnabled={localesEnabled}
        />
        <section
          className="sf-layout-section"
          data-sf-section="fallback-main"
          data-sf-container={fallbackMode}
        >
          <div className="sf-grid-row">
            <div
              className="sf-grid-col"
              data-sf-width={12}
              style={{ flex: '0 0 100%', maxWidth: '100%', width: '100%' }}
            >
              <div className="sf-page-content public-main">{children}</div>
            </div>
          </div>
        </section>
        <p className="site-footer-meta sf-layout-chrome-meta">
          <span className="site-footer-brand">{siteName}</span>
          <span className="site-footer-sep" aria-hidden="true">
            ·
          </span>
          <span>Built with Starforge</span>
        </p>
      </div>
    )
  }

  const document = await getLayoutDocument(layoutId)
  const { flow, footers } = partitionSectionsForPublicPaint(document.sections)
  const hasPageContent = documentHasPageContent([...flow, ...footers])
  const breakpoints = document.styles?.breakpoints ?? DEFAULT_LAYOUT_BREAKPOINTS
  const pageDefault = sectionsLayout
  const flowChunks = chunkSectionsForMosaic(flow)
  const footerChunks = chunkSectionsForMosaic(footers)

  const paintChunks = (chunks: ReturnType<typeof chunkSectionsForMosaic>) =>
    chunks.map((chunk) =>
      chunk.kind === 'single' ? (
        <SectionBlock
          key={chunk.section.id}
          section={chunk.section}
          pageContent={children}
          pageDefault={pageDefault}
        />
      ) : (
        <div
          key={`mosaic-${chunk.sections.map((s) => s.id).join('-')}`}
          className="sf-layout-section-mosaic"
        >
          {chunk.sections.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              pageContent={children}
              pageDefault={pageDefault}
            />
          ))}
        </div>
      ),
    )

  return (
    <div
      className={shellClass}
      data-sf-skin={skin.dataAttr}
      data-sf-layout-version={document.version}
      data-sf-layout-id={resolvedLayoutId}
      data-sf-sections-layout={sectionsLayout}
      data-sf-mobile-menu="collapse"
    >
      <LayoutOutlineStyles layoutId={resolvedLayoutId} breakpoints={breakpoints} />
      {paintChunks(flowChunks)}

      {!hasPageContent ? (
        <section
          className="sf-layout-section"
          data-sf-section="fallback-main"
          data-sf-container={resolveSectionContainerMode(undefined, pageDefault)}
          data-sf-width={100}
        >
          <div className="sf-grid-row">
            <div className="sf-grid-col" data-sf-width={12} style={{ flex: '0 0 100%', maxWidth: '100%', width: '100%' }}>
              <div className="sf-page-content public-main">{children}</div>
            </div>
          </div>
        </section>
      ) : null}

      {paintChunks(footerChunks)}

      <p className="site-footer-meta sf-layout-chrome-meta">
        <span className="site-footer-brand">{siteName}</span>
        <span className="site-footer-sep" aria-hidden="true">
          ·
        </span>
        <span>Built with Starforge</span>
      </p>
    </div>
  )
}

import React from 'react'

import type { NavItem } from '@/core/settings/defaults'
import { ensureModulesRegistered } from '@/modules/catalog'

import { LayoutOutlineStyles } from './LayoutOutlineStyles'
import { getLayoutDocument } from './layout'
import { isFooterLayoutSection, partitionSectionsForPublicPaint } from './section-order'
import {
  DEFAULT_LAYOUT_BREAKPOINTS,
  buildSectionInlineStyle,
  resolveSectionContainerMode,
  type LayoutContainerMode,
} from './styles'
import { SlotRenderer } from './SlotRenderer'
import type { LayoutRow, LayoutSection } from './types'

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

function SectionBlock({
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
  const sectionStyle = buildSectionInlineStyle(section.styles)
  const overlayOn = section.styles?.backgroundOverlay === 'enabled'

  const inner = (
    <>
      {rows.map((row) => (
        <LayoutRowView key={row.id} sectionId={section.id} row={row} pageContent={pageContent} />
      ))}
    </>
  )

  if (isFooter) {
    return (
      <footer
        className={sectionWrapperClass(section, 'site-footer sf-layout-section')}
        data-sf-section={section.id}
        data-sf-container={containerMode}
        data-sf-section-styled={sectionStyle ? 'true' : undefined}
        data-sf-overlay={overlayOn ? 'enabled' : undefined}
        style={sectionStyle}
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
      data-sf-section-styled={sectionStyle ? 'true' : undefined}
      data-sf-overlay={overlayOn ? 'enabled' : undefined}
      style={sectionStyle}
    >
      {inner}
    </section>
  )
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
 * Section canvas order is user `order` (DnD). Public paint only moves
 * footer-named sections to the end so Main particles stay above `<footer>` —
 * stored orders are not rewritten.
 *
 * Section `containerMode` owns full vs boxed width; row % is share inside.
 */
export async function PublicLayoutBody({
  children,
  siteName,
  primaryNav,
  layoutId,
  sectionsLayout = 'fullwidth',
  layoutManagerEnabled = true,
}: Props) {
  ensureModulesRegistered()
  const resolvedLayoutId = layoutId || 'default'
  const shellClass = [
    'public-shell',
    sectionsLayout === 'boxed' ? 'sf-sections-boxed' : 'sf-sections-fullwidth',
  ].join(' ')

  if (!layoutManagerEnabled) {
    const { SiteHeader } = await import('@/components/SiteHeader')
    const fallbackMode = resolveSectionContainerMode(undefined, sectionsLayout)
    return (
      <div
        className={shellClass}
        data-sf-layout-id="minimal"
        data-sf-sections-layout={sectionsLayout}
        data-sf-mobile-menu="collapse"
      >
        <LayoutOutlineStyles layoutId="minimal" breakpoints={DEFAULT_LAYOUT_BREAKPOINTS} />
        <SiteHeader siteName={siteName} primaryNav={primaryNav} />
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

  return (
    <div
      className={shellClass}
      data-sf-layout-version={document.version}
      data-sf-layout-id={resolvedLayoutId}
      data-sf-sections-layout={sectionsLayout}
      data-sf-mobile-menu="collapse"
    >
      <LayoutOutlineStyles layoutId={resolvedLayoutId} breakpoints={breakpoints} />
      {flow.map((section) => (
        <SectionBlock
          key={section.id}
          section={section}
          pageContent={children}
          pageDefault={pageDefault}
        />
      ))}

      {!hasPageContent ? (
        <section
          className="sf-layout-section"
          data-sf-section="fallback-main"
          data-sf-container={resolveSectionContainerMode(undefined, pageDefault)}
        >
          <div className="sf-grid-row">
            <div className="sf-grid-col" data-sf-width={12} style={{ flex: '0 0 100%', maxWidth: '100%', width: '100%' }}>
              <div className="sf-page-content public-main">{children}</div>
            </div>
          </div>
        </section>
      ) : null}

      {footers.map((section) => (
        <SectionBlock
          key={section.id}
          section={section}
          pageContent={children}
          pageDefault={pageDefault}
        />
      ))}

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

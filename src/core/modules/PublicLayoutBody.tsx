import React from 'react'

import type { NavItem } from '@/core/settings/defaults'
import { ensureModulesRegistered } from '@/modules/catalog'

import { getLayoutDocument } from './layout'
import { SlotRenderer } from './SlotRenderer'
import type { LayoutRow, LayoutSection } from './types'

type Props = {
  children: React.ReactNode
  siteName: string
  primaryNav: NavItem[]
  /** Page Settings layout assignment (`sf_layouts` id). */
  layoutId?: string
  /** Sections layout mode from Page Settings. */
  sectionsLayout?: 'fullwidth' | 'boxed'
}

function sortByOrder<T extends { order?: number; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
}

function SectionBlock({
  section,
  pageContent,
}: {
  section: LayoutSection
  pageContent: React.ReactNode
}) {
  const rows = sortByOrder(section.rows)
  const isFooter =
    section.id.includes('footer') || section.label.toLowerCase().includes('footer')

  const inner = (
    <>
      {rows.map((row) => (
        <LayoutRowView key={row.id} sectionId={section.id} row={row} pageContent={pageContent} />
      ))}
    </>
  )

  if (isFooter) {
    return (
      <footer className="site-footer sf-layout-section" data-sf-section={section.id}>
        {inner}
      </footer>
    )
  }

  return (
    <section className="sf-layout-section" data-sf-section={section.id}>
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
 */
export async function PublicLayoutBody({
  children,
  siteName,
  layoutId,
  sectionsLayout = 'fullwidth',
}: Props) {
  ensureModulesRegistered()
  const document = await getLayoutDocument(layoutId)
  const sections = sortByOrder(document.sections)
  const hasPageContent = documentHasPageContent(sections)
  const shellClass = [
    'public-shell',
    sectionsLayout === 'boxed' ? 'sf-sections-boxed' : 'sf-sections-fullwidth',
  ].join(' ')

  return (
    <div
      className={shellClass}
      data-sf-layout-version={document.version}
      data-sf-layout-id={layoutId || 'default'}
      data-sf-sections-layout={sectionsLayout}
    >
      {sections.map((section) => (
        <SectionBlock key={section.id} section={section} pageContent={children} />
      ))}

      {!hasPageContent ? (
        <section className="sf-layout-section" data-sf-section="fallback-main">
          <div className="sf-grid-row">
            <div className="sf-grid-col" data-sf-width={12} style={{ flex: '0 0 100%', maxWidth: '100%', width: '100%' }}>
              <div className="sf-page-content public-main">{children}</div>
            </div>
          </div>
        </section>
      ) : null}

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

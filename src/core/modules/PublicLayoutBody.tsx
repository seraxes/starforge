import React from 'react'

import { SiteHeader } from '@/components/SiteHeader'
import type { NavItem } from '@/core/settings/defaults'

import { ModuleSlot } from './ModuleSlot'
import { getLayoutDocument } from './layout'
import type { LayoutPosition, LayoutSection } from './types'

type Props = {
  children: React.ReactNode
  siteName: string
  primaryNav: NavItem[]
}

function sortByOrder<T extends { order?: number; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
}

function isFooterSection(section: LayoutSection): boolean {
  return section.id.includes('footer') || section.label.toLowerCase().includes('footer')
}

function PositionSlots({
  positions,
  classNamePrefix,
}: {
  positions: LayoutPosition[]
  classNamePrefix: string
}) {
  return (
    <>
      {sortByOrder(positions).map((pos) => (
        <ModuleSlot
          key={pos.id}
          position={pos.id}
          className={`${classNamePrefix} sf-slot-${pos.id}`}
        />
      ))}
    </>
  )
}

function ContentSection({
  section,
  children,
  siteName,
  primaryNav,
}: {
  section: LayoutSection
  children: React.ReactNode
  siteName: string
  primaryNav: NavItem[]
}) {
  const before = section.positions.filter((p) => p.placement !== 'after')
  const after = section.positions.filter((p) => p.placement === 'after')

  return (
    <section className="sf-layout-section sf-layout-section-content" data-sf-section={section.id}>
      <PositionSlots positions={before} classNamePrefix="sf-slot-before-content" />
      <SiteHeader siteName={siteName} primaryNav={primaryNav} />
      <div className="public-main">{children}</div>
      <PositionSlots positions={after} classNamePrefix="sf-slot-after-content" />
    </section>
  )
}

function ChromeSection({
  section,
  siteName,
}: {
  section: LayoutSection
  siteName: string
}) {
  if (isFooterSection(section)) {
    return (
      <footer className="site-footer sf-layout-section" data-sf-section={section.id}>
        <PositionSlots positions={section.positions} classNamePrefix="sf-slot-footer" />
        <p className="site-footer-meta">
          <span className="site-footer-brand">{siteName}</span>
          <span className="site-footer-sep" aria-hidden="true">
            ·
          </span>
          <span>Built with Starforge</span>
        </p>
      </footer>
    )
  }

  return (
    <section className="sf-layout-section" data-sf-section={section.id}>
      <PositionSlots positions={section.positions} classNamePrefix="sf-slot-chrome" />
    </section>
  )
}

/**
 * Public site body driven by the layout document (sections → positions → modules).
 * Falls back to the checked-in default when the DB row is empty.
 * SiteHeader + page children render inside the section marked `content: true`.
 */
export async function PublicLayoutBody({ children, siteName, primaryNav }: Props) {
  const document = await getLayoutDocument()
  const sections = sortByOrder(document.sections)
  const hasContentSection = sections.some((s) => s.content)
  const hasFooterSection = sections.some(isFooterSection)

  return (
    <div className="public-shell" data-sf-layout-version={document.version}>
      {sections.map((section) =>
        section.content ? (
          <ContentSection
            key={section.id}
            section={section}
            siteName={siteName}
            primaryNav={primaryNav}
          >
            {children}
          </ContentSection>
        ) : (
          <ChromeSection key={section.id} section={section} siteName={siteName} />
        ),
      )}

      {!hasContentSection ? (
        <section
          className="sf-layout-section sf-layout-section-content"
          data-sf-section="fallback-main"
        >
          <SiteHeader siteName={siteName} primaryNav={primaryNav} />
          <div className="public-main">{children}</div>
        </section>
      ) : null}

      {!hasFooterSection ? (
        <footer className="site-footer sf-layout-section" data-sf-section="fallback-footer">
          <p className="site-footer-meta">
            <span className="site-footer-brand">{siteName}</span>
            <span className="site-footer-sep" aria-hidden="true">
              ·
            </span>
            <span>Built with Starforge</span>
          </p>
        </footer>
      ) : null}
    </div>
  )
}

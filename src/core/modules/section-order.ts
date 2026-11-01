import type { LayoutSection } from './types'

/**
 * Semantic paint bands for public + admin section ordering.
 * Prevents the id-alphabetical trap: when `order` ties at 0/missing,
 * `footer`.localeCompare(`main`) puts Footer *before* Main in the DOM —
 * so particles in Main (e.g. Form) appear after `<footer class="site-footer">`.
 */
export function isFooterLayoutSection(
  section: Pick<LayoutSection, 'id' | 'label'>,
): boolean {
  const id = section.id.trim().toLowerCase()
  const label = section.label.trim().toLowerCase()
  return id === 'footer' || id.includes('footer') || label.includes('footer')
}

export function isHeaderLayoutSection(
  section: Pick<LayoutSection, 'id' | 'label'>,
): boolean {
  const id = section.id.trim().toLowerCase()
  const label = section.label.trim().toLowerCase()
  return id === 'header' || id.includes('header') || label.includes('header')
}

export function isNavigationLayoutSection(
  section: Pick<LayoutSection, 'id' | 'label'>,
): boolean {
  const id = section.id.trim().toLowerCase()
  const label = section.label.trim().toLowerCase()
  return (
    id === 'navigation' ||
    id === 'nav' ||
    id.includes('navigation') ||
    label.includes('navigation') ||
    label === 'nav'
  )
}

/** Lower = earlier in the document. Footer is always last band. */
export function layoutSectionBand(
  section: Pick<LayoutSection, 'id' | 'label'>,
): number {
  if (isFooterLayoutSection(section)) return 40
  if (isHeaderLayoutSection(section)) return 0
  if (isNavigationLayoutSection(section)) return 10
  const id = section.id.trim().toLowerCase()
  if (id === 'main' || id.includes('main')) return 20
  return 30
}

/**
 * Stable section comparator: semantic band → numeric order → id.
 * Use for public render, admin canvas, and normalize/save heal.
 */
export function compareLayoutSections(
  a: Pick<LayoutSection, 'id' | 'label' | 'order'>,
  b: Pick<LayoutSection, 'id' | 'label' | 'order'>,
): number {
  const band = layoutSectionBand(a) - layoutSectionBand(b)
  if (band !== 0) return band
  const order = (a.order ?? 0) - (b.order ?? 0)
  if (order !== 0) return order
  return a.id.localeCompare(b.id)
}

export function sortLayoutSections<T extends Pick<LayoutSection, 'id' | 'label' | 'order'>>(
  sections: T[],
): T[] {
  return [...sections].sort(compareLayoutSections)
}

/** Re-index `order` 0..n-1 after semantic sort (heals tied/wrong stored orders). */
export function reindexLayoutSectionOrders(sections: LayoutSection[]): LayoutSection[] {
  const sorted = sortLayoutSections(sections)
  sorted.forEach((s, i) => {
    s.order = i
  })
  return sorted
}

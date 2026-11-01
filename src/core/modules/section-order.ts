import type { LayoutSection } from './types'

/**
 * Section ordering helpers.
 *
 * **Stored / admin order** is always numeric `section.order` (user DnD).
 * Never rewrite saved orders with semantic “bands” — that scrambled the
 * layout canvas (e.g. TOP dragged to top jumped before Footer).
 *
 * **Public paint** may partition footer-named sections to the end so Main
 * particles cannot appear after `<footer class="site-footer">` when orders
 * are tied or mis-set — without mutating stored `order` values.
 */

export function isFooterLayoutSection(
  section: Pick<LayoutSection, 'id' | 'label'>,
): boolean {
  const id = section.id.trim().toLowerCase()
  const label = section.label.trim().toLowerCase()
  return id === 'footer' || id.includes('footer') || label.includes('footer')
}

/** Admin / normalize: respect user `order` only (then id). */
export function compareLayoutSectionsByOrder(
  a: Pick<LayoutSection, 'id' | 'order'>,
  b: Pick<LayoutSection, 'id' | 'order'>,
): number {
  const order = (a.order ?? 0) - (b.order ?? 0)
  if (order !== 0) return order
  return a.id.localeCompare(b.id)
}

export function sortLayoutSectionsByOrder<T extends Pick<LayoutSection, 'id' | 'order'>>(
  sections: T[],
): T[] {
  return [...sections].sort(compareLayoutSectionsByOrder)
}

/**
 * Re-index `order` 0..n-1 **preserving current relative order**
 * (by existing order field, then id). Does not apply semantic bands.
 */
export function reindexLayoutSectionOrders(sections: LayoutSection[]): LayoutSection[] {
  const sorted = sortLayoutSectionsByOrder(sections)
  sorted.forEach((s, i) => {
    s.order = i
  })
  return sorted
}

/**
 * Public-only paint order: numeric order, then move footer-named sections
 * to the end (stable among themselves). Does not mutate `section.order`.
 */
export function partitionSectionsForPublicPaint<
  T extends Pick<LayoutSection, 'id' | 'label' | 'order'>,
>(sections: T[]): { flow: T[]; footers: T[] } {
  const sorted = sortLayoutSectionsByOrder(sections)
  const flow: T[] = []
  const footers: T[] = []
  for (const section of sorted) {
    if (isFooterLayoutSection(section)) footers.push(section)
    else flow.push(section)
  }
  return { flow, footers }
}

/** @deprecated Use compareLayoutSectionsByOrder — bands broke admin DnD. */
export const compareLayoutSections = compareLayoutSectionsByOrder
/** @deprecated Use sortLayoutSectionsByOrder */
export const sortLayoutSections = sortLayoutSectionsByOrder

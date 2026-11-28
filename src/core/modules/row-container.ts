import { clampGridWidth, LAYOUT_WIDTH_FULL } from './grid'
import type { LayoutContainerMode } from './styles'
import type { LayoutRowContainer, LayoutSectionStyles } from './types'

/** Section fields the row packer reads. */
export type RowPackSection = {
  id: string
  width?: number
  containerMode?: LayoutContainerMode
}

export type PackedSectionLine<T extends RowPackSection = RowPackSection> = {
  sections: T[]
}

/**
 * Pack sections into visual lines.
 * A full-width section is its own line. Partial widths share a line until the
 * next one would pass 100%.
 */
export function packSectionsIntoLines<T extends RowPackSection>(sections: T[]): PackedSectionLine<T>[] {
  const lines: PackedSectionLine<T>[] = []
  let buf: T[] = []
  let sum = 0
  const flush = () => {
    if (buf.length === 0) return
    lines.push({ sections: buf })
    buf = []
    sum = 0
  }
  for (const section of sections) {
    const width = clampGridWidth(section.width ?? LAYOUT_WIDTH_FULL, LAYOUT_WIDTH_FULL)
    if (width >= LAYOUT_WIDTH_FULL) {
      flush()
      lines.push({ sections: [section] })
      continue
    }
    if (buf.length > 0 && sum + width > LAYOUT_WIDTH_FULL) flush()
    buf.push(section)
    sum += width
  }
  flush()
  return lines
}

/** Explicit container mode shared by every section, or undefined when mixed / omitted. */
export function sharedContainerMode(
  sections: Array<{ containerMode?: LayoutContainerMode }>,
): LayoutContainerMode | undefined {
  if (sections.length === 0) return undefined
  const first = sections[0]?.containerMode
  if (first !== 'full' && first !== 'boxed') return undefined
  return sections.every((section) => section.containerMode === first) ? first : undefined
}

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const want = new Set(b)
  return a.every((id) => want.has(id))
}

/** Stored row container whose section ids match this line exactly. */
export function rowContainerForSections(
  containers: LayoutRowContainer[] | undefined,
  sectionIds: string[],
): LayoutRowContainer | undefined {
  return containers?.find((container) => sameIdSet(container.sectionIds, sectionIds))
}

/**
 * Container mode painted on a side-by-side row.
 * A saved container wins (including “unset” → page default). With no record yet,
 * a mode shared by every member is the stand-in.
 */
export function lineContainerMode(
  stored: LayoutRowContainer | undefined,
  sections: Array<{ containerMode?: LayoutContainerMode }>,
): LayoutContainerMode | undefined {
  if (stored) return stored.containerMode
  return sharedContainerMode(sections)
}

function defaultCreateId(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `rowc-${rand}`
}

function takeBestOverlap(
  pool: LayoutRowContainer[],
  sectionIds: string[],
): LayoutRowContainer | undefined {
  let best = -1
  let bestScore = 0
  const want = new Set(sectionIds)
  pool.forEach((container, index) => {
    const score = container.sectionIds.filter((id) => want.has(id)).length
    if (score > bestScore) {
      bestScore = score
      best = index
    }
  })
  if (best < 0) return undefined
  return pool.splice(best, 1)[0]
}

/**
 * Keep saved row-container settings attached to the lines those sections now
 * occupy. Lines with a single section drop their container. `createMissing`
 * inserts a Container for a new side-by-side line.
 */
export function syncRowContainers(
  sections: RowPackSection[],
  containers: LayoutRowContainer[] | undefined,
  opts?: { createMissing?: boolean; createId?: () => string },
): LayoutRowContainer[] | undefined {
  const lines = packSectionsIntoLines(sections).filter((line) => line.sections.length > 1)
  const pool = (containers ?? []).map((container) => ({
    ...container,
    sectionIds: [...container.sectionIds],
    ...(container.styles ? { styles: { ...container.styles } } : {}),
  }))
  const next: LayoutRowContainer[] = []
  for (const line of lines) {
    const sectionIds = line.sections.map((section) => section.id)
    const matched = takeBestOverlap(pool, sectionIds)
    if (matched) {
      next.push({ ...matched, sectionIds })
      continue
    }
    if (!opts?.createMissing) continue
    const containerMode = sharedContainerMode(line.sections)
    next.push({
      id: (opts.createId ?? defaultCreateId)(),
      label: 'Container',
      sectionIds,
      ...(containerMode ? { containerMode } : {}),
    })
  }
  return next.length > 0 ? next : undefined
}

export type RowContainerPatch = {
  label?: string
  htmlId?: string | null
  cssClass?: string | null
  containerMode?: LayoutContainerMode
  backgroundColor?: string | null
  textColor?: string | null
  padding?: string | null
  margin?: string | null
}

function applyStylePatch(
  current: LayoutSectionStyles | undefined,
  patch: RowContainerPatch,
): LayoutSectionStyles | undefined {
  const next: LayoutSectionStyles = { ...(current ?? {}) }
  if (patch.backgroundColor === null) delete next.backgroundColor
  else if (patch.backgroundColor !== undefined) next.backgroundColor = patch.backgroundColor
  if (patch.textColor === null) delete next.textColor
  else if (patch.textColor !== undefined) next.textColor = patch.textColor
  if (patch.padding === null) delete next.padding
  else if (patch.padding !== undefined) next.padding = patch.padding
  if (patch.margin === null) delete next.margin
  else if (patch.margin !== undefined) next.margin = patch.margin
  return Object.keys(next).length > 0 ? next : undefined
}

/**
 * Write basic section settings onto the row container for one side-by-side line.
 * Fails when those ids are not together on one line, or the name is empty.
 */
export function applyRowContainerPatch(
  sections: RowPackSection[],
  containers: LayoutRowContainer[] | undefined,
  input: { sectionIds: string[]; containerId?: string; patch: RowContainerPatch },
  createId: () => string = defaultCreateId,
): { ok: true; containers: LayoutRowContainer[] } | { ok: false; error: string } {
  const wanted = [...new Set(input.sectionIds.map((id) => id.trim()).filter(Boolean))]
  const line = packSectionsIntoLines(sections).find(
    (entry) => entry.sections.length > 1 && sameIdSet(entry.sections.map((section) => section.id), wanted),
  )
  if (!line) {
    return { ok: false, error: 'These sections are not side by side on one row.' }
  }
  if (input.patch.label !== undefined && !input.patch.label.trim()) {
    return { ok: false, error: 'Container name is required.' }
  }
  const sectionIds = line.sections.map((section) => section.id)
  const synced = syncRowContainers(sections, containers, { createMissing: false }) ?? []
  const containerId = input.containerId?.trim()
  const existing =
    (containerId
      ? synced.find((container) => container.id === containerId)
      : undefined) ?? rowContainerForSections(synced, sectionIds)
  const base: LayoutRowContainer = existing
    ? { ...existing, sectionIds, ...(existing.styles ? { styles: { ...existing.styles } } : {}) }
    : {
        id: containerId || createId(),
        label: 'Container',
        sectionIds,
        ...(sharedContainerMode(line.sections)
          ? { containerMode: sharedContainerMode(line.sections) }
          : {}),
      }
  if (input.patch.label !== undefined) base.label = input.patch.label.trim()
  if (input.patch.htmlId === null) delete base.htmlId
  else if (input.patch.htmlId) base.htmlId = input.patch.htmlId
  if (input.patch.cssClass === null) delete base.cssClass
  else if (input.patch.cssClass) base.cssClass = input.patch.cssClass
  if (input.patch.containerMode) base.containerMode = input.patch.containerMode
  const styles = applyStylePatch(base.styles, input.patch)
  if (styles) base.styles = styles
  else delete base.styles
  const without = synced.filter((container) => container.id !== base.id)
  return { ok: true, containers: [...without, base] }
}

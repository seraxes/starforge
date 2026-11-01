import { accessTagsForStorage } from '@/core/acl/nav-access'

import defaultLayoutJson from './default-layout.json'
import { clampGridWidth, LAYOUT_WIDTH_FULL, normalizeRowWidthsToPercent } from './grid'
import { sortLayoutSectionsByOrder } from './section-order'
import { asContainerMode, normalizeLayoutOutlineStyles } from './styles'
import type {
  LayoutDocument,
  LayoutDocumentV1,
  LayoutDocumentV2,
  LayoutRow,
  LayoutSection,
  LayoutSlot,
  LayoutSlotConfig,
} from './types'

/** Human label → kebab-case id. */
export function slugifyLayoutId(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'untitled'
}

/**
 * Keep only safe CSS class tokens (letters/digits/_/-; must start with letter or _).
 * Returns undefined when nothing remains.
 */
export function sanitizeCssClassList(raw: string | undefined | null): string | undefined {
  if (typeof raw !== 'string') return undefined
  const tokens = raw
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => /^[A-Za-z_][\w-]*$/.test(t))
  if (tokens.length === 0) return undefined
  return [...new Set(tokens)].join(' ')
}

/** Trim instance / section display labels; empty → undefined. */
export function sanitizeDisplayName(raw: string | undefined | null): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function newLayoutEntityId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${rand}`
}

function normalizeConfig(raw: unknown): LayoutSlotConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const cfg = raw as LayoutSlotConfig
  const out: LayoutSlotConfig = {}
  if (typeof cfg.html === 'string') out.html = cfg.html
  if (typeof cfg.css === 'string') out.css = cfg.css
  if (typeof cfg.js === 'string') out.js = cfg.js
  if (typeof cfg.title === 'string') out.title = cfg.title
  for (const [key, value] of Object.entries(cfg)) {
    if (key === 'html' || key === 'css' || key === 'js' || key === 'title') continue
    out[key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function normalizeSlot(entry: LayoutSlot | null | undefined, index: number): LayoutSlot | null {
  if (!entry || typeof entry.moduleId !== 'string' || !entry.moduleId.trim()) return null
  const id =
    typeof entry.id === 'string' && entry.id.trim()
      ? entry.id.trim()
      : newLayoutEntityId(`slot-${entry.moduleId}`)
  const config = normalizeConfig(entry.config)
  const name = sanitizeDisplayName(entry.name)
  const accessTags = accessTagsForStorage({
    accessTags: entry.accessTags,
    accessLevel: entry.accessLevel,
  })
  return {
    id,
    moduleId: entry.moduleId.trim(),
    ...(name ? { name } : {}),
    // Provisional width — row pass converts legacy 1–12 columns → %.
    width: typeof entry.width === 'number' && Number.isFinite(entry.width) ? entry.width : LAYOUT_WIDTH_FULL,
    enabled: entry.enabled !== false,
    order: typeof entry.order === 'number' && Number.isFinite(entry.order) ? entry.order : index,
    ...(accessTags ? { accessTags } : {}),
    ...(config ? { config } : {}),
  }
}

function normalizeRow(entry: LayoutRow | null | undefined, index: number): LayoutRow | null {
  if (!entry) return null
  const id =
    typeof entry.id === 'string' && entry.id.trim()
      ? entry.id.trim()
      : newLayoutEntityId('row')
  const slots = Array.isArray(entry.slots)
    ? (entry.slots.map((s, i) => normalizeSlot(s, i)).filter(Boolean) as LayoutSlot[])
    : []
  slots.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
  const percents = normalizeRowWidthsToPercent(slots.map((s) => s.width))
  slots.forEach((slot, i) => {
    slot.width = clampGridWidth(percents[i] ?? LAYOUT_WIDTH_FULL)
  })
  return {
    id,
    order: typeof entry.order === 'number' && Number.isFinite(entry.order) ? entry.order : index,
    slots,
  }
}

function normalizeSection(entry: LayoutSection | null | undefined, index: number): LayoutSection | null {
  if (!entry || typeof entry.id !== 'string' || !entry.id.trim()) return null
  const id = entry.id.trim()
  const label =
    typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : id
  const cssClass = sanitizeCssClassList(entry.cssClass)
  const containerMode = asContainerMode(entry.containerMode)
  const rows = Array.isArray(entry.rows)
    ? (entry.rows.map((r, i) => normalizeRow(r, i)).filter(Boolean) as LayoutRow[])
    : []
  rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
  return {
    id,
    label,
    ...(cssClass ? { cssClass } : {}),
    ...(containerMode ? { containerMode } : {}),
    order: typeof entry.order === 'number' && Number.isFinite(entry.order) ? entry.order : index,
    rows,
  }
}

function withNormalizedStyles(doc: LayoutDocument, raw: unknown): LayoutDocument {
  const styles = normalizeLayoutOutlineStyles(
    raw && typeof raw === 'object' ? (raw as { styles?: unknown }).styles : undefined,
  )
  return styles ? { ...doc, styles } : doc
}

function slotsFromModules(
  modules: Array<{
    moduleId: string
    enabled?: boolean
    order?: number
    width?: number
    config?: LayoutSlotConfig
  }>,
  idPrefix: string,
): LayoutSlot[] {
  return modules
    .map((m, index) =>
      normalizeSlot(
        {
          id: `${idPrefix}-${m.moduleId}-${index}`,
          moduleId: m.moduleId,
          width: m.width ?? 12,
          enabled: m.enabled,
          order: m.order ?? index,
          config: m.config,
        },
        index,
      ),
    )
    .filter(Boolean) as LayoutSlot[]
}

/** Upgrade flat v1 assignments → v3 sections/rows/slots. */
export function upgradeLayoutV1(doc: LayoutDocumentV1): LayoutDocument {
  const byPosition = new Map<string, LayoutSlot[]>()
  for (const raw of doc.assignments ?? []) {
    if (!raw || typeof raw.moduleId !== 'string' || typeof raw.position !== 'string') continue
    const position = raw.position.trim()
    if (!position) continue
    const list = byPosition.get(position) ?? []
    const slot = normalizeSlot(
      {
        id: `${position}-${raw.moduleId}-${list.length}`,
        moduleId: raw.moduleId,
        width: 100,
        enabled: raw.enabled,
        order: raw.order ?? list.length,
      },
      list.length,
    )
    if (slot) {
      list.push(slot)
      byPosition.set(position, list)
    }
  }

  if (byPosition.size === 0) return cloneDefaultLayoutDocument()

  const sections: LayoutSection[] = []
  let order = 0
  for (const [positionId, slots] of byPosition) {
    sections.push({
      id: positionId,
      label: positionId,
      order: order++,
      rows: [{ id: `${positionId}-row-1`, order: 0, slots }],
    })
  }

  // Ensure page-content exists somewhere.
  if (!documentHasModule(sections, 'page-content')) {
    sections.push({
      id: 'main',
      label: 'Main',
      order: order++,
      rows: [
        {
          id: 'main-row-1',
          order: 0,
          slots: [
            {
              id: 'main-page-content',
              moduleId: 'page-content',
              width: 100,
              enabled: true,
              order: 0,
            },
          ],
        },
      ],
    })
  }

  return normalizeLayoutDocument({ version: 3, sections }) ?? { version: 3, sections }
}

/** Upgrade v2 positions → v3 rows/slots (+ inject page-content for content sections). */
export function upgradeLayoutV2(doc: LayoutDocumentV2): LayoutDocument {
  const sections: LayoutSection[] = []

  for (const section of doc.sections ?? []) {
    if (!section?.id) continue
    const rows: LayoutRow[] = []
    let rowOrder = 0

    if (section.content) {
      rows.push({
        id: `${section.id}-page-content-row`,
        order: rowOrder++,
        slots: [
          {
            id: `${section.id}-page-content`,
            moduleId: 'page-content',
            width: 100,
            enabled: true,
            order: 0,
          },
        ],
      })
    }

    for (const position of section.positions ?? []) {
      if (!position?.id) continue
      const before = (position.placement ?? 'before') !== 'after'
      if (section.content && !before) {
        // after-content style: row after page-content
        rows.push({
          id: `${position.id}-row`,
          order: rowOrder++,
          slots: slotsFromModules(position.modules ?? [], position.id),
        })
      } else if (section.content && before) {
        rows.unshift({
          id: `${position.id}-row`,
          order: -1,
          slots: slotsFromModules(position.modules ?? [], position.id),
        })
      } else {
        rows.push({
          id: `${position.id}-row`,
          order: rowOrder++,
          slots: slotsFromModules(position.modules ?? [], position.id),
        })
      }
    }

    // Re-index row orders after unshift.
    rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
    rows.forEach((r, i) => {
      r.order = i
    })

    sections.push({
      id: section.id,
      label: section.label || section.id,
      order: section.order ?? sections.length,
      rows,
    })
  }

  if (sections.length === 0) return cloneDefaultLayoutDocument()

  if (!documentHasModule(sections, 'site-header')) {
    sections.unshift({
      id: 'navigation',
      label: 'Navigation',
      order: -1,
      rows: [
        {
          id: 'navigation-row-1',
          order: 0,
          slots: [
            {
              id: 'navigation-site-header',
              moduleId: 'site-header',
              width: 100,
              enabled: true,
              order: 0,
            },
          ],
        },
      ],
    })
  }

  if (!documentHasModule(sections, 'page-content')) {
    sections.push({
      id: 'main',
      label: 'Main',
      order: 99,
      rows: [
        {
          id: 'main-row-1',
          order: 0,
          slots: [
            {
              id: 'main-page-content',
              moduleId: 'page-content',
              width: 100,
              enabled: true,
              order: 0,
            },
          ],
        },
      ],
    })
  }

  // Preserve relative order; assign sequential order indices (no semantic bands).
  sortLayoutSectionsByOrder(sections).forEach((s, i) => {
    s.order = i
  })

  return normalizeLayoutDocument({ version: 3, sections }) ?? { version: 3, sections }
}

function documentHasModule(sections: LayoutSection[], moduleId: string): boolean {
  return sections.some((s) => s.rows.some((r) => r.slots.some((slot) => slot.moduleId === moduleId)))
}

export function normalizeLayoutDocument(raw: unknown): LayoutDocument | null {
  if (!raw || typeof raw !== 'object') return null
  const doc = raw as { version?: number }

  if (doc.version === 1 && Array.isArray((raw as LayoutDocumentV1).assignments)) {
    return upgradeLayoutV1(raw as LayoutDocumentV1)
  }

  if (doc.version === 2 && Array.isArray((raw as LayoutDocumentV2).sections)) {
    return upgradeLayoutV2(raw as LayoutDocumentV2)
  }

  if (doc.version !== 3 || !Array.isArray((raw as LayoutDocument).sections)) {
    // Accept unversioned v3-shaped docs that already have rows.
    const maybe = raw as LayoutDocument
    if (Array.isArray(maybe.sections) && maybe.sections.some((s) => Array.isArray(s?.rows))) {
      const sections = maybe.sections
        .map((s, i) => normalizeSection(s, i))
        .filter(Boolean) as LayoutSection[]
      // Sort by stored order only — never semantic bands (breaks admin DnD).
      return withNormalizedStyles(
        { version: 3, sections: sortLayoutSectionsByOrder(sections) },
        raw,
      )
    }
    return null
  }

  const sections = ((raw as LayoutDocument).sections.map((s, i) => normalizeSection(s, i)).filter(
    Boolean,
  ) as LayoutSection[])
  // Keep user / drag order. Public paint partitions footers separately.
  return withNormalizedStyles(
    { version: 3, sections: sortLayoutSectionsByOrder(sections) },
    raw,
  )
}

export function cloneDefaultLayoutDocument(): LayoutDocument {
  const normalized = normalizeLayoutDocument(defaultLayoutJson)
  if (normalized) return structuredClone(normalized)
  return { version: 3, sections: [] }
}

export function parseLayoutDocumentJson(json: string): LayoutDocument | null {
  try {
    return normalizeLayoutDocument(JSON.parse(json) as unknown)
  } catch {
    return null
  }
}

export function serializeLayoutDocument(doc: LayoutDocument): string {
  return JSON.stringify(normalizeLayoutDocument(doc) ?? { version: 3, sections: [] }, null, 2)
}

export function findSection(doc: LayoutDocument, sectionId: string): LayoutSection | undefined {
  return doc.sections.find((s) => s.id === sectionId)
}

export function findRow(
  doc: LayoutDocument,
  sectionId: string,
  rowId: string,
): { section: LayoutSection; row: LayoutRow } | undefined {
  const section = findSection(doc, sectionId)
  if (!section) return undefined
  const row = section.rows.find((r) => r.id === rowId)
  if (!row) return undefined
  return { section, row }
}

export function findSlot(
  doc: LayoutDocument,
  sectionId: string,
  rowId: string,
  slotId: string,
): { section: LayoutSection; row: LayoutRow; slot: LayoutSlot } | undefined {
  const found = findRow(doc, sectionId, rowId)
  if (!found) return undefined
  const slot = found.row.slots.find((s) => s.id === slotId)
  if (!slot) return undefined
  return { ...found, slot }
}

/** @deprecated v2 helper — kept for transitional imports. */
export function flattenAssignmentsForPosition() {
  return []
}

/** @deprecated v2 helper */
export function listPositions() {
  return []
}

/** @deprecated v2 helper */
export function findPosition() {
  return undefined
}

import defaultLayoutJson from './default-layout.json'
import type {
  LayoutDocument,
  LayoutDocumentV1,
  LayoutModuleAssignment,
  LayoutPosition,
  LayoutPositionId,
  LayoutSection,
} from './types'

/** Human label → kebab-case id (stable enough for admin-created positions). */
export function slugifyLayoutId(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'untitled'
}

function normalizeModule(entry: LayoutModuleAssignment | null | undefined): LayoutModuleAssignment | null {
  if (!entry || typeof entry.moduleId !== 'string' || !entry.moduleId.trim()) return null
  return {
    moduleId: entry.moduleId.trim(),
    enabled: entry.enabled !== false,
    order: typeof entry.order === 'number' && Number.isFinite(entry.order) ? entry.order : 0,
  }
}

function normalizePosition(entry: LayoutPosition | null | undefined): LayoutPosition | null {
  if (!entry || typeof entry.id !== 'string' || !entry.id.trim()) return null
  const id = entry.id.trim()
  const label =
    typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : id
  const modules = Array.isArray(entry.modules)
    ? (entry.modules.map(normalizeModule).filter(Boolean) as LayoutModuleAssignment[])
    : []
  modules.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.moduleId.localeCompare(b.moduleId))

  const placement =
    entry.placement === 'before' || entry.placement === 'after' ? entry.placement : undefined

  return {
    id: id as LayoutPositionId,
    label,
    order: typeof entry.order === 'number' && Number.isFinite(entry.order) ? entry.order : 0,
    ...(placement ? { placement } : {}),
    modules,
  }
}

function normalizeSection(entry: LayoutSection | null | undefined): LayoutSection | null {
  if (!entry || typeof entry.id !== 'string' || !entry.id.trim()) return null
  const id = entry.id.trim()
  const label =
    typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : id
  const positions = Array.isArray(entry.positions)
    ? (entry.positions.map(normalizePosition).filter(Boolean) as LayoutPosition[])
    : []
  positions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))

  return {
    id,
    label,
    order: typeof entry.order === 'number' && Number.isFinite(entry.order) ? entry.order : 0,
    ...(entry.content ? { content: true as const } : {}),
    positions,
  }
}

/** Upgrade flat v1 assignments into the sections → positions shape. */
export function upgradeLayoutV1(doc: LayoutDocumentV1): LayoutDocument {
  const byPosition = new Map<string, LayoutModuleAssignment[]>()
  for (const raw of doc.assignments ?? []) {
    if (!raw || typeof raw.moduleId !== 'string' || typeof raw.position !== 'string') continue
    const position = raw.position.trim()
    if (!position) continue
    const mod = normalizeModule({
      moduleId: raw.moduleId,
      enabled: raw.enabled,
      order: raw.order,
    })
    if (!mod) continue
    const list = byPosition.get(position) ?? []
    list.push(mod)
    byPosition.set(position, list)
  }

  const knownOrder = ['header', 'after-content', 'footer']
  const orderedIds = [
    ...knownOrder.filter((id) => byPosition.has(id)),
    ...[...byPosition.keys()].filter((id) => !knownOrder.includes(id)).sort(),
  ]

  // Preserve empty default slots when upgrading an empty v1 doc.
  if (orderedIds.length === 0) {
    return cloneDefaultLayoutDocument()
  }

  const headerMods = byPosition.get('header') ?? []
  const afterMods = byPosition.get('after-content') ?? []
  const footerMods = byPosition.get('footer') ?? []
  const extras = orderedIds.filter((id) => !knownOrder.includes(id))

  const sections: LayoutSection[] = [
    {
      id: 'header-section',
      label: 'Header',
      order: 0,
      positions: [
        {
          id: 'header',
          label: 'Header',
          order: 0,
          modules: headerMods,
        },
        ...extras.map((id, index) => ({
          id: id as LayoutPositionId,
          label: id,
          order: index + 1,
          modules: byPosition.get(id) ?? [],
        })),
      ],
    },
    {
      id: 'main-section',
      label: 'Main',
      order: 1,
      content: true,
      positions: [
        {
          id: 'after-content',
          label: 'After content',
          order: 0,
          placement: 'after' as const,
          modules: afterMods,
        },
      ],
    },
    {
      id: 'footer-section',
      label: 'Footer',
      order: 2,
      positions: [
        {
          id: 'footer',
          label: 'Footer',
          order: 0,
          modules: footerMods,
        },
      ],
    },
  ]

  return (
    normalizeLayoutDocument({ version: 2, sections }) ?? {
      version: 2,
      sections,
    }
  )
}

export function normalizeLayoutDocument(raw: unknown): LayoutDocument | null {
  if (!raw || typeof raw !== 'object') return null
  const doc = raw as { version?: number }

  if (doc.version === 1 && Array.isArray((raw as LayoutDocumentV1).assignments)) {
    return upgradeLayoutV1(raw as LayoutDocumentV1)
  }

  if (doc.version !== 2 || !Array.isArray((raw as LayoutDocument).sections)) {
    return null
  }

  const sections = ((raw as LayoutDocument).sections.map(normalizeSection).filter(Boolean) as LayoutSection[])
  sections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))

  return { version: 2, sections }
}

export function cloneDefaultLayoutDocument(): LayoutDocument {
  const normalized = normalizeLayoutDocument(defaultLayoutJson)
  if (normalized) return structuredClone(normalized)
  return { version: 2, sections: [] }
}

export function parseLayoutDocumentJson(json: string): LayoutDocument | null {
  try {
    return normalizeLayoutDocument(JSON.parse(json) as unknown)
  } catch {
    return null
  }
}

export function serializeLayoutDocument(doc: LayoutDocument): string {
  return JSON.stringify(normalizeLayoutDocument(doc) ?? { version: 2, sections: [] }, null, 2)
}

/** Flat enabled assignments for one position id (public ModuleSlot path). */
export function flattenAssignmentsForPosition(
  doc: LayoutDocument,
  position: LayoutPositionId,
): LayoutModuleAssignment[] {
  const out: LayoutModuleAssignment[] = []
  for (const section of doc.sections) {
    for (const pos of section.positions) {
      if (pos.id !== position) continue
      for (const mod of pos.modules) {
        if (mod.enabled === false) continue
        out.push(mod)
      }
    }
  }
  return out.sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.moduleId.localeCompare(b.moduleId),
  )
}

export function listPositions(doc: LayoutDocument): LayoutPosition[] {
  const positions: LayoutPosition[] = []
  for (const section of [...doc.sections].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
  )) {
    for (const pos of [...section.positions].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
    )) {
      positions.push(pos)
    }
  }
  return positions
}

export function findSection(doc: LayoutDocument, sectionId: string): LayoutSection | undefined {
  return doc.sections.find((s) => s.id === sectionId)
}

export function findPosition(
  doc: LayoutDocument,
  sectionId: string,
  positionId: string,
): { section: LayoutSection; position: LayoutPosition } | undefined {
  const section = findSection(doc, sectionId)
  if (!section) return undefined
  const position = section.positions.find((p) => p.id === positionId)
  if (!position) return undefined
  return { section, position }
}

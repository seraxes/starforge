/**
 * Deterministic order for manifest `boot` declarations.
 * Layer first (base, site, advanced). Within a layer, hard `requires`
 * before dependents. Remaining ties break by module id.
 * `optionalRequires` is not an edge.
 */

import { requiresEdges } from './requires-graph'

export const BOOT_LAYER_ORDER = ['base', 'site', 'advanced'] as const

export type BootLayer = (typeof BOOT_LAYER_ORDER)[number]

const BOOT_LAYER_RANK: Record<BootLayer, number> = {
  base: 0,
  site: 1,
  advanced: 2,
}

const EXPORT_NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/

export type BootOrderNode = {
  id: string
  layer?: string
  requires?: readonly string[]
  boot?: {
    importPath?: string
    exportName?: string
  }
}

export type OrderedModuleBoot = {
  id: string
  layer: BootLayer
  importPath: string
  exportName: string
}

type BootNode = BootOrderNode & {
  layer: BootLayer
  importPath: string
  exportName: string
}

function isBootLayer(layer: string | undefined): layer is BootLayer {
  return layer === 'base' || layer === 'site' || layer === 'advanced'
}

/**
 * Boot dependencies of `startId`: other boot modules reachable through
 * hard `requires`. Throws when that walk hits a cycle.
 */
function collectBootDependencies(
  startId: string,
  edges: Map<string, readonly string[]>,
  bootIds: ReadonlySet<string>,
): string[] {
  const deps: string[] = []
  const seen = new Set<string>()
  const stack = new Set<string>([startId])

  function walk(id: string): void {
    for (const dep of edges.get(id) ?? []) {
      if (dep === startId || stack.has(dep)) {
        throw new Error(`Cyclic boot order: ${startId} requires ${dep} (through ${id})`)
      }
      if (seen.has(dep)) continue
      seen.add(dep)
      if (bootIds.has(dep)) deps.push(dep)
      stack.add(dep)
      walk(dep)
      stack.delete(dep)
    }
  }

  walk(startId)
  return deps
}

function orderLayer(group: readonly BootNode[], bootDeps: ReadonlyMap<string, readonly string[]>): BootNode[] {
  const ids = group.map((node) => node.id)
  const idSet = new Set(ids)
  const indegree = new Map(ids.map((id) => [id, 0]))
  const after = new Map<string, string[]>(ids.map((id) => [id, []]))
  const byId = new Map(group.map((node) => [node.id, node]))

  for (const id of ids) {
    const sameLayerDeps = [...new Set((bootDeps.get(id) ?? []).filter((dep) => idSet.has(dep)))]
    indegree.set(id, sameLayerDeps.length)
    for (const dep of sameLayerDeps) {
      after.get(dep)?.push(id)
    }
  }

  const ready = ids.filter((id) => (indegree.get(id) ?? 0) === 0).sort((a, b) => a.localeCompare(b))
  const orderedIds: string[] = []

  while (ready.length) {
    const next = ready.shift()
    if (!next) break
    orderedIds.push(next)
    const dependents = [...(after.get(next) ?? [])].sort((a, b) => a.localeCompare(b))
    for (const dependent of dependents) {
      const left = (indegree.get(dependent) ?? 0) - 1
      indegree.set(dependent, left)
      if (left === 0) {
        ready.push(dependent)
        ready.sort((a, b) => a.localeCompare(b))
      }
    }
  }

  if (orderedIds.length !== ids.length) {
    const stuck = ids.filter((id) => !orderedIds.includes(id))
    const layer = group[0]?.layer ?? 'unknown'
    throw new Error(`Cyclic boot order in layer ${layer}: ${stuck.join(', ')}`)
  }

  return orderedIds.map((id) => {
    const node = byId.get(id)
    if (!node) throw new Error(`Missing boot node ${id}`)
    return node
  })
}

/**
 * Sort modules that declare `boot`. Modules without `boot` stay in the
 * graph so transitive `requires` still order the boot list.
 */
export function orderModuleBoot(nodes: readonly BootOrderNode[]): OrderedModuleBoot[] {
  const seenIds = new Set<string>()
  for (const node of nodes) {
    if (seenIds.has(node.id)) {
      throw new Error(`Duplicate module id in boot graph: ${node.id}`)
    }
    seenIds.add(node.id)
  }

  const bootNodes: BootNode[] = []
  for (const node of nodes) {
    if (!node.boot) continue
    const importPath = node.boot.importPath?.trim() ?? ''
    const exportName = node.boot.exportName?.trim() ?? ''
    if (!importPath || !exportName) {
      throw new Error(
        `Invalid boot declaration on ${node.id}: importPath and exportName are required`,
      )
    }
    if (!EXPORT_NAME.test(exportName)) {
      throw new Error(`Invalid boot exportName on ${node.id}: ${exportName}`)
    }
    if (!isBootLayer(node.layer)) {
      throw new Error(`Boot module ${node.id} must set layer to base, site, or advanced`)
    }
    bootNodes.push({ ...node, layer: node.layer, importPath, exportName })
  }

  const edges = requiresEdges(nodes)
  const bootIds = new Set(bootNodes.map((node) => node.id))
  const bootDeps = new Map<string, string[]>()
  for (const node of bootNodes) {
    bootDeps.set(node.id, collectBootDependencies(node.id, edges, bootIds))
  }

  const layerOf = new Map(bootNodes.map((node) => [node.id, node.layer]))
  for (const node of bootNodes) {
    for (const dep of bootDeps.get(node.id) ?? []) {
      const depLayer = layerOf.get(dep)
      if (!depLayer) continue
      if (BOOT_LAYER_RANK[depLayer] > BOOT_LAYER_RANK[node.layer]) {
        throw new Error(
          `Invalid boot order: ${node.id} (${node.layer}) depends on ${dep} (${depLayer}), which boots in a later layer`,
        )
      }
    }
  }

  const ordered: BootNode[] = []
  for (const layer of BOOT_LAYER_ORDER) {
    const group = bootNodes.filter((node) => node.layer === layer)
    ordered.push(...orderLayer(group, bootDeps))
  }

  return ordered.map((node) => ({
    id: node.id,
    layer: node.layer,
    importPath: node.importPath,
    exportName: node.exportName,
  }))
}

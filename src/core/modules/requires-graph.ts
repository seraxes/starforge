/**
 * Install + runtime closure for manifest `requires`.
 * Direct edges live on each module manifest. This file only walks them.
 */

export type RequiresNode = {
  id: string
  requires?: readonly string[]
}

export function requiresEdges(
  nodes: readonly RequiresNode[],
): Map<string, readonly string[]> {
  const edges = new Map<string, readonly string[]>()
  for (const node of nodes) {
    edges.set(node.id, node.requires ?? [])
  }
  return edges
}

/** Direct + transitive dependency ids. Does not include `id` itself. */
export function transitiveRequires(
  id: string,
  edges: Map<string, readonly string[]>,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const stack = [...(edges.get(id) ?? [])]
  while (stack.length) {
    const next = stack.pop()
    if (!next || seen.has(next) || next === id) continue
    seen.add(next)
    out.push(next)
    for (const dep of edges.get(next) ?? []) {
      if (!seen.has(dep)) stack.push(dep)
    }
  }
  return out
}

/**
 * Union `requested` with every transitive `requires`.
 * Unknown requested ids and unknown required ids throw — those are manifest bugs.
 */
export function closeModuleRequires(
  requested: readonly string[],
  nodes: readonly RequiresNode[],
): { ids: string[]; pulled: string[] } {
  const edges = requiresEdges(nodes)
  const known = new Set(edges.keys())
  const unknownRequested = requested.filter((id) => !known.has(id))
  if (unknownRequested.length) {
    throw new Error(`Unknown module ids: ${unknownRequested.join(', ')}`)
  }

  const out = new Set(requested)
  const pulled: string[] = []
  const queue = [...requested]
  const walked = new Set<string>()
  while (queue.length) {
    const id = queue.pop()
    if (!id || walked.has(id)) continue
    walked.add(id)
    for (const req of edges.get(id) ?? []) {
      if (!known.has(req)) {
        throw new Error(`${id} requires unknown module ${req}`)
      }
      if (!out.has(req)) {
        out.add(req)
        pulled.push(req)
      }
      if (!walked.has(req)) queue.push(req)
    }
  }

  const sort = (a: string, b: string) => a.localeCompare(b)
  return {
    ids: [...out].sort(sort),
    pulled: [...new Set(pulled)].sort(sort),
  }
}

export type ToggleResolveInput = {
  /** Effective on/off before this save. */
  previous: Record<string, boolean>
  /** Effective on/off the admin submitted. */
  requested: Record<string, boolean>
  nodes: readonly RequiresNode[]
  labels?: Record<string, string>
}

/**
 * Turning a module on turns its transitive requires on.
 * Turning a module off fails when another module that stays on still needs it
 * and it was on before this save. Leaving a dependency off while enabling its
 * consumer pulls the dependency on (it was not switched off).
 */
export function resolveModuleToggleRequires(
  input: ToggleResolveInput,
): { toggles: Record<string, boolean> } | { error: string } {
  const edges = requiresEdges(input.nodes)
  const expanded: Record<string, boolean> = { ...input.requested }
  const enabledIds = Object.entries(input.requested)
    .filter(([, on]) => on)
    .map(([id]) => id)

  for (const id of enabledIds) {
    for (const req of transitiveRequires(id, edges)) {
      expanded[req] = true
    }
  }

  const conflicts: string[] = []
  for (const [id, on] of Object.entries(input.requested)) {
    if (on) continue
    if (expanded[id] !== true) continue
    if (input.previous[id] !== true) continue
    const holders = enabledIds.filter((holder) =>
      transitiveRequires(holder, edges).includes(id),
    )
    if (!holders.length) continue
    const label = input.labels?.[id] ?? id
    const holderLabels = holders.map((holder) => input.labels?.[holder] ?? holder)
    conflicts.push(`${label} is required by ${holderLabels.join(', ')}`)
  }

  if (conflicts.length) {
    return {
      error: `Cannot turn off a module another pack needs: ${conflicts.join('; ')}`,
    }
  }

  return { toggles: expanded }
}

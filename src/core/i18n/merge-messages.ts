/**
 * Merge Core + Module next-intl message trees (i18n P3).
 * Module packs nest under their declared namespace (usually the module id).
 */

export type MessageTree = Record<string, unknown>

/** Deep-merge plain objects; later trees win on leaf conflicts. Arrays replace. */
export function mergeMessageTrees(...trees: MessageTree[]): MessageTree {
  const out: MessageTree = {}
  for (const tree of trees) {
    if (!tree || typeof tree !== 'object' || Array.isArray(tree)) continue
    mergeInto(out, tree)
  }
  return out
}

function mergeInto(target: MessageTree, source: MessageTree): void {
  for (const [key, value] of Object.entries(source)) {
    if (value == null) continue
    const existing = target[key]
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      mergeInto(existing as MessageTree, value as MessageTree)
      continue
    }
    target[key] = value
  }
}

/**
 * Nest a module message leaf under its namespace(s).
 * Single namespace + flat leaf → `{ [ns]: leaf }`.
 * Multi-namespace files must already key each namespace at the top level.
 */
export function wrapModuleMessages(
  namespaces: readonly string[],
  leaf: MessageTree,
): MessageTree {
  if (!namespaces.length) return {}
  if (namespaces.length === 1) {
    const ns = namespaces[0]!
    const nested = leaf[ns]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return { [ns]: nested }
    }
    return { [ns]: leaf }
  }
  const out: MessageTree = {}
  for (const ns of namespaces) {
    const part = leaf[ns]
    if (part && typeof part === 'object' && !Array.isArray(part)) {
      out[ns] = part
    }
  }
  return out
}

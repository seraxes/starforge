import type { StarforgeAtomDefinition } from '../types'

const atomsByType = new Map<string, StarforgeAtomDefinition>()

export function registerAtom(atom: StarforgeAtomDefinition): void {
  if (!atom?.type || typeof atom.type !== 'string') {
    throw new Error('registerAtom: atom.type is required')
  }
  if (typeof atom.inject !== 'function') {
    throw new Error(`registerAtom(${atom.type}): inject() is required`)
  }
  atomsByType.set(atom.type, atom)
}

export function getRegisteredAtom(type: string): StarforgeAtomDefinition | undefined {
  return atomsByType.get(type)
}

export function listRegisteredAtoms(): StarforgeAtomDefinition[] {
  return [...atomsByType.values()].sort((a, b) => a.label.localeCompare(b.label))
}

export function clearAtomRegistry(): void {
  atomsByType.clear()
}

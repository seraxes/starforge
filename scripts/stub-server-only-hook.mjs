import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const shim = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), 'server-only-shim.mjs')).href

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return { shortCircuit: true, url: shim }
  }
  return nextResolve(specifier, context)
}

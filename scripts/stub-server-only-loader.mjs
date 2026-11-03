/**
 * Node ESM loader: resolve `server-only` to an empty shim for CLI runs.
 * Usage: node --import ./scripts/register-server-only-stub.mjs …
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./stub-server-only-hook.mjs', import.meta.url)

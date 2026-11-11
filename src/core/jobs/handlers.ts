import type { JobHandler } from './types'

type HandlersGlobal = typeof globalThis & {
  __starforgeJobHandlers?: Map<string, JobHandler>
}

function handlerMap(): Map<string, JobHandler> {
  const g = globalThis as HandlersGlobal
  if (!g.__starforgeJobHandlers) {
    g.__starforgeJobHandlers = new Map()
  }
  return g.__starforgeJobHandlers
}

/** Register (or replace) a named job handler. */
export function registerJobHandler(name: string, handler: JobHandler): void {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('registerJobHandler: name is required')
  }
  handlerMap().set(trimmed, handler)
}

export function getJobHandler(name: string): JobHandler | undefined {
  return handlerMap().get(name.trim())
}

/** Test helper — drop all registered handlers. */
export function clearJobHandlers(): void {
  handlerMap().clear()
}

/**
 * Process boot runner (Stage 6).
 *
 * The generated registry owns the loader list and the order.
 * This function only executes the list it is given. It does not sort.
 * `src/instrumentation.ts` imports `@/generated/module-registry.server`
 * and calls the generated `runModuleBoot()`, which passes `bootLoaders` here.
 */

export type ModuleBootLoader = {
  moduleId: string
  load: () => Promise<() => void | Promise<void>>
}

/**
 * Run boot loaders in the supplied order.
 * A loader that throws is skipped so later loaders still run — the same
 * isolation as the separate try/catch blocks that used to live in
 * `src/instrumentation.ts` (`pack missing / migrate pending`).
 */
export async function runModuleBoot(loaders: readonly ModuleBootLoader[]): Promise<void> {
  for (const entry of loaders) {
    try {
      const boot = await entry.load()
      await boot()
    } catch {
      // pack missing / migrate pending
    }
  }
}

/**
 * Site Settings toggle read for a boot function.
 * Uses the uncached loader: process boot runs from Next instrumentation,
 * before `unstable_cache` has an incremental cache. `getSiteSettings`
 * throws "incrementalCache missing" on that path and would skip every pack.
 * Throws when the live read itself throws; the boot function's try/catch
 * then skips jobs and sweeps instead of starting them.
 */
export async function isCatalogBootEnabled(moduleId: string): Promise<boolean> {
  const { getSiteSettingsLive, isCatalogModuleEnabled } = await import('@/core/settings')
  return isCatalogModuleEnabled(await getSiteSettingsLive(), moduleId)
}

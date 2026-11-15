/**
 * Next.js instrumentation — runs once when the Node server starts.
 * Boots Starforge env validation, then the generated module boot list,
 * then the hero boot loader (null when the active hero declares no boot).
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Edge runtime has no full Node env contract / file-backed secrets.
  if (process.env.NEXT_RUNTIME === 'edge') return

  const { assertStarforgeEnvAtBoot } = await import('./core/env/validate')
  assertStarforgeEnvAtBoot()

  const { runHeroBoot, runModuleBoot } = await import('@/generated/module-registry.server')
  await runModuleBoot()
  await runHeroBoot()
}

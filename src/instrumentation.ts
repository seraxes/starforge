/**
 * Next.js instrumentation — runs once when the Node server starts.
 * Boots Starforge env validation (design-data-deploy §3 / SF-139).
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Edge runtime has no full Node env contract / file-backed secrets.
  if (process.env.NEXT_RUNTIME === 'edge') return

  const { assertStarforgeEnvAtBoot } = await import('./core/env/validate')
  assertStarforgeEnvAtBoot()
}

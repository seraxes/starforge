/**
 * product:marketplace public-door gate.
 *
 * Callers inject the enabled flag (or a thunk) so unit tests do not need Site Settings.
 * When Marketplace is off, this returns immediately and never runs `work`.
 */

export type MarketplaceDoorResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'disabled' }

/**
 * Run Marketplace work only when the pack is on.
 * Off → `{ ok: false, reason: 'disabled' }` with no side effects.
 */
export async function runMarketplaceDoor<T>(
  isEnabled: boolean | (() => boolean | Promise<boolean>),
  work: () => T | Promise<T>,
): Promise<MarketplaceDoorResult<T>> {
  const enabled = typeof isEnabled === 'function' ? await isEnabled() : isEnabled
  if (!enabled) return { ok: false, reason: 'disabled' }
  return { ok: true, value: await work() }
}

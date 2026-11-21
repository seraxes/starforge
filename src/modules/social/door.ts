/**
 * product:social public-door gate.
 *
 * Callers inject the enabled flag (or a thunk) so unit tests do not need Site Settings.
 * When Social is off, this returns immediately and never runs `work`.
 */

export type SocialDoorResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'disabled' }

/**
 * Run Social work only when the pack is on.
 * Off → `{ ok: false, reason: 'disabled' }` with no side effects.
 */
export async function runSocialDoor<T>(
  isEnabled: boolean | (() => boolean | Promise<boolean>),
  work: () => T | Promise<T>,
): Promise<SocialDoorResult<T>> {
  const enabled = typeof isEnabled === 'function' ? await isEnabled() : isEnabled
  if (!enabled) return { ok: false, reason: 'disabled' }
  return { ok: true, value: await work() }
}

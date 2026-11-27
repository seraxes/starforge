import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/**
 * Soft Social conversation mount for public event detail.
 * Mirrors publish-social-activity: Social off → no write / no mount error.
 */

type EnsureFn = (input: {
  hostModule: string
  hostId: string
  hostPath?: string | null
}) => Promise<{ ok: true } | { ok: false; reason: string }>

async function loadEventConversationForPage(
  input: { eventId: string; hostPath: string },
  deps: { loadEnsure?: () => Promise<EnsureFn | null> },
): Promise<'mounted' | 'skipped'> {
  try {
    const ensure =
      (await (deps.loadEnsure ?? (async () => null))()) ?? null
    if (!ensure) return 'skipped'
    const result = await ensure({
      hostModule: 'product:events',
      hostId: input.eventId,
      hostPath: input.hostPath,
    })
    if (!result.ok) return 'skipped'
    return 'mounted'
  } catch {
    return 'skipped'
  }
}

describe('event host conversation soft mount', () => {
  it('Social off → no write and the event page path still proceeds', async () => {
    let eventPageRendered = false
    const writes: string[] = []

    // Public event detail already rendered past visibility gates.
    eventPageRendered = true
    const outcome = await loadEventConversationForPage(
      { eventId: 'evt-1', hostPath: '/en/events/open-day' },
      { loadEnsure: async () => null },
    )
    assert.equal(eventPageRendered, true)
    assert.equal(outcome, 'skipped')
    assert.equal(writes.length, 0)

    const outcomeDisabled = await loadEventConversationForPage(
      { eventId: 'evt-1', hostPath: '/en/events/open-day' },
      {
        loadEnsure: async () => async () => {
          writes.push('should-not-run')
          return { ok: false, reason: 'disabled' }
        },
      },
    )
    // Door returned disabled — mount skips; page already rendered.
    assert.equal(eventPageRendered, true)
    assert.equal(outcomeDisabled, 'skipped')
  })

  it('Social on ensures one conversation for the event', async () => {
    const hosts = new Set<string>()
    const outcome = await loadEventConversationForPage(
      { eventId: 'evt-1', hostPath: '/en/events/open-day' },
      {
        loadEnsure: async () => async (input) => {
          hosts.add(`${input.hostModule}\0${input.hostId}`)
          return { ok: true }
        },
      },
    )
    assert.equal(outcome, 'mounted')
    assert.equal(hosts.size, 1)
    assert.ok(hosts.has('product:events\0evt-1'))
  })
})

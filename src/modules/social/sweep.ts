/**
 * product:social self-rescheduling sweep (`social.sweep`).
 *
 * Slice 12 registers the job and the challenge handler. Slice 16 adds story
 * expiry to this same runner — do not register a second job.
 * Boot arms the sweep only when Social is enabled.
 */

import 'server-only'

import { getJobRunner, registerJobHandler } from '@/core/jobs'

import {
  applyChallengeSweepFromDb,
  type ChallengeSweepDbResult,
} from './challenge-store'
import {
  applyStorySweepFromDb,
  type StorySweepDbResult,
} from './stories-store'

export const SOCIAL_SWEEP_JOB = 'social.sweep' as const
export const SOCIAL_SWEEP_MS = 60_000

type SweepGlobal = typeof globalThis & {
  __sfSocialSweep?: boolean
}

/**
 * Challenge handler for social.sweep (expire invites/uploads, lock past endsAt).
 */
export async function runSocialChallengeSweep(
  now = new Date(),
): Promise<ChallengeSweepDbResult> {
  return applyChallengeSweepFromDb(now)
}

/**
 * Story expiry handler for social.sweep (mark expiredAt past expiresAt).
 * Same job as challenges — do not register a second runner. Media file stays.
 */
export async function runSocialStorySweep(
  now = new Date(),
): Promise<StorySweepDbResult> {
  return applyStorySweepFromDb(now)
}

/** Full sweep body — challenges + story expiry. */
export async function runSocialSweep(now = new Date()): Promise<{
  challenge: ChallengeSweepDbResult
  stories: StorySweepDbResult
}> {
  const challenge = await runSocialChallengeSweep(now)
  const stories = await runSocialStorySweep(now)
  return { challenge, stories }
}

async function enqueueSocialSweep(delayMs: number): Promise<boolean> {
  const runAt = Date.now() + Math.max(0, delayMs)
  try {
    const result = await getJobRunner().enqueue({
      name: SOCIAL_SWEEP_JOB,
      runAt,
      idempotencyKey: `${SOCIAL_SWEEP_JOB}:${Math.floor(runAt / SOCIAL_SWEEP_MS)}`,
    })
    return result.ok
  } catch (error) {
    console.error('[social] sweep schedule failed', error)
    return false
  }
}

/**
 * Arm a self-rescheduling social.sweep. Safe to call more than once.
 * Caller must only arm when Social is enabled (boot returns early when off).
 */
export function ensureSocialSweep(): void {
  registerJobHandler(SOCIAL_SWEEP_JOB, async () => {
    try {
      await runSocialSweep()
    } finally {
      await enqueueSocialSweep(SOCIAL_SWEEP_MS)
    }
  })

  const g = globalThis as SweepGlobal
  if (g.__sfSocialSweep) return
  g.__sfSocialSweep = true
  void enqueueSocialSweep(0).then((ok) => {
    if (!ok) g.__sfSocialSweep = false
  })
}

import 'server-only'

import type { SecondaryStorage } from 'better-auth'

import { getRedisClient } from '@/core/redis'

import { createSecondaryStorage } from './secondary-storage'

/** Production factory — shared `REDIS_URL` client + `STARFORGE_REDIS_PREFIX`. */
export function createRedisSecondaryStorage(): SecondaryStorage {
  return createSecondaryStorage(getRedisClient())
}

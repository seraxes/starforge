/**
 * Redis port foundation — shared client for cache (now) and later
 * rate-limit / BullMQ. Product code should not import Redis directly.
 */
export { getRedisClient, redisUrlFromEnv } from './client'

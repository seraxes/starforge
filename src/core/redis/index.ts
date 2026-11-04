/**
 * Redis port foundation — shared client for cache + rate-limit
 * (queues later). Product code should not import Redis directly.
 */
export { getRedisClient, redisUrlFromEnv } from './client'
export { redisKeyPrefix } from './prefix'

/**
 * product:marketplace public door (client-safe surface).
 *
 *   import { MARKETPLACE_MODULE_ID, runMarketplaceDoor } from '@/modules/marketplace/api'
 *
 * Server reads stay on `@/modules/marketplace/api.server`.
 */

export { MARKETPLACE_MODULE_ID } from './ids'
export { runMarketplaceDoor } from './door'
export type { MarketplaceDoorResult } from './door'

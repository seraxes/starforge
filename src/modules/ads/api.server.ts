/**
 * product:ads server door.
 *
 *   import { listPackages, findPackageById } from '@/modules/ads/api.server'
 *
 * Checkout, fulfillment hooks, and Social publish land in later slices.
 */

import 'server-only'

export { ADS_MODULE_ID } from './ids'

export {
  CAMPAIGN_STATUSES,
  isCampaignStatus,
} from './types'
export type {
  AdsCampaignRecord,
  AdsCreditBalanceRecord,
  AdsPackageRecord,
  AdsPlacementRecord,
  CampaignStatus,
} from './types'

export {
  findCampaignById,
  findCreditBalanceByBuyer,
  findPackageById,
  findPlacementById,
  listCampaigns,
  listPackages,
  listPlacements,
} from './store'

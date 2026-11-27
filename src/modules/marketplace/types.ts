import type { ListingCondition, ListingStatus } from './listing-rules'

/** Marketplace category row + default-locale title/description from content locales. */
export type MarketplaceCategoryRecord = {
  id: string
  /** Default-locale title (content-locale file; not a DB column). */
  title: string
  slug: string
  /** Default-locale description (content-locale file; not a DB column). */
  description: string
  parentId: string
  enabled: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

/** Listing row for admin moderation and later public surfaces. */
export type MarketplaceListingRecord = {
  id: string
  sellerUserId: string
  categoryId: string
  title: string
  description: string
  priceMinor: number | null
  condition: ListingCondition
  status: ListingStatus
  areaLabel: string
  latitude: number | null
  longitude: number | null
  expiresAt: Date | null
  soldToUserId: string | null
  mediaIds: string[]
  createdAt: Date
  updatedAt: Date
}

/** Module settings document in `sf_module_settings` (id = product:marketplace). */
export type MarketplaceModuleSettings = {
  /** Days until a newly published / renewed listing expires. */
  expiryDays: number
  /** Max ordered media ids on a listing. */
  photoCap: number
  /** When false, offer writes are refused (slice 6). */
  offersEnabled: boolean
  /**
   * When true, publish stays draft until `marketplace.listingFeePaid`.
   * Saving this switch does not call Payments.
   */
  listingFeeEnabled: boolean
  /** Listing-fee amount in minor units when the fee is on (quoted server-side). */
  listingFeeMinor: number
}

export const DEFAULT_MARKETPLACE_MODULE_SETTINGS: MarketplaceModuleSettings = {
  expiryDays: 30,
  photoCap: 10,
  offersEnabled: true,
  listingFeeEnabled: false,
  listingFeeMinor: 0,
}

/** Common expiry-day choices for the admin select (controlled). */
export const MARKETPLACE_EXPIRY_DAY_OPTIONS = [7, 14, 30, 60, 90] as const

/** Common photo-cap choices for the admin select (controlled). */
export const MARKETPLACE_PHOTO_CAP_OPTIONS = [1, 3, 5, 10, 15, 20] as const

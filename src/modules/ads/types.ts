/** Campaign lifecycle statuses for this pack. */
export const CAMPAIGN_STATUSES = ['draft', 'pending', 'live', 'offline'] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

export function isCampaignStatus(value: unknown): value is CampaignStatus {
  return (
    value === 'draft' ||
    value === 'pending' ||
    value === 'live' ||
    value === 'offline'
  )
}

export type AdsPackageRecord = {
  id: string
  title: string
  description: string
  /** Major units (site currency). */
  price: number
  creditGrant: number
  active: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export type AdsPlacementRecord = {
  id: string
  label: string
  key: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

export type AdsCreditBalanceRecord = {
  id: string
  buyerUserId: string
  balance: number
  createdAt: Date
  updatedAt: Date
}

export type AdsCampaignRecord = {
  id: string
  buyerUserId: string
  packageId: string
  placementIds: string[]
  startsAt: Date | null
  endsAt: Date | null
  status: CampaignStatus
  creativeMediaId: string
  copyTitle: string
  copyBody: string
  socialPostId: string | null
  createdAt: Date
  updatedAt: Date
}

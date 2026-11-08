import type { TicketTierKind } from '../types'

/** Public ticket / faction card view model. */
export type PublicTicketTier = {
  id: string
  title: string
  shortDescription: string
  description: string
  kind: TicketTierKind
  priceLabel: string
  titleColor: string
  borderColor: string
  backgroundColor: string
  capacity: number | null
  /** Max tickets allowed on one booking (effective, never null). */
  maxPerBooking: number
  occupied: number
  remaining: number | null
  soldOut: boolean
}

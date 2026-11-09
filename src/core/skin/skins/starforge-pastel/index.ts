import type { LayoutDocument } from '@/core/modules/types'
import type { Skin } from '../../types'

import pastelDefaultOutline from './outlines/default.json'
import pastelOfflineOutline from './outlines/offline.json'
import { starforgePastelTokens } from './tokens'

export const STARFORGE_PASTEL_SKIN_ID = 'starforge-pastel' as const
export const STARFORGE_PASTEL_DEFAULT_OUTLINE_ID = 'starforge-pastel-default' as const
export const STARFORGE_PASTEL_OFFLINE_OUTLINE_ID = 'starforge-pastel-offline' as const

/**
 * First public skin: cool light pastel orange/blue + Base outline seed
 * (Gantry-like theme package: brand + outlines).
 */
export const starforgePastelSkin: Skin = {
  id: STARFORGE_PASTEL_SKIN_ID,
  label: 'Starforge Pastel',
  dataAttr: STARFORGE_PASTEL_SKIN_ID,
  colorScheme: 'light',
  tokens: starforgePastelTokens,
  preferredDefaultOutlineId: STARFORGE_PASTEL_DEFAULT_OUTLINE_ID,
  outlineSeeds: [
    {
      id: STARFORGE_PASTEL_DEFAULT_OUTLINE_ID,
      /** Skin Base shell — every new Pastel outline inherits from this by default. */
      label: 'Pastel — Base',
      document: pastelDefaultOutline as LayoutDocument,
      defaultForSite: true,
    },
    {
      id: STARFORGE_PASTEL_OFFLINE_OUTLINE_ID,
      label: 'Pastel — Offline',
      document: pastelOfflineOutline as LayoutDocument,
    },
  ],
}

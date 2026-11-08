import type { LayoutDocument } from '@/core/modules/types'
import type { Skin } from '../../types'

import pastelDefaultOutline from './outlines/default.json'
import { starforgePastelTokens } from './tokens'

export const STARFORGE_PASTEL_SKIN_ID = 'starforge-pastel' as const
export const STARFORGE_PASTEL_DEFAULT_OUTLINE_ID = 'starforge-pastel-default' as const

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
      label: 'Pastel — Default',
      document: pastelDefaultOutline as LayoutDocument,
      defaultForSite: true,
    },
  ],
}

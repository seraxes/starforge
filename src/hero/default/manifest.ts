import type { HeroManifest } from '../types'

/**
 * Shipped hero. No profile fields, no boot, no skin preference.
 * The profile editor, event registration, and subscription activation stay as they are.
 */
export const hero: HeroManifest = {
  id: 'default',
  label: 'Default',
}

import type { LayoutSlot, LayoutSlotConfig } from '../types'

export type ParticleEditorNavMenuOption = { id: string; label: string }
export type ParticleEditorFormDefinitionOption = { id: string; label: string }

/** Shared props for manifest-loaded particle cog editors. */
export type ParticleEditorProps = {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  embedded?: boolean
  onConfigSaved?: (config: LayoutSlotConfig) => void
  navMenus?: ParticleEditorNavMenuOption[]
  formDefinitions?: ParticleEditorFormDefinitionOption[]
  formsModuleEnabled?: boolean
  primaryNavMenuId?: string
}

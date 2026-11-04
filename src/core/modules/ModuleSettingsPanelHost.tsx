/**
 * Settings topic host — loads a module's contributed settings panel (M2).
 * Packs declare `settings.panelImportPath`; codegen emits `moduleSettingsPanelLoaders`.
 */
import React from 'react'

import { moduleSettingsPanelLoaders } from '@/generated/module-registry.server'

export type ModuleSettingsPanelHostProps = {
  moduleId: string
  /** Optional props forwarded to the panel (document, topic helpers, …). */
  panelProps?: Record<string, unknown>
}

/**
 * Renders the generated settings panel for `moduleId`, or a muted fallback
 * when the pack did not contribute a panel (or is not allowlisted).
 */
export async function ModuleSettingsPanelHost({
  moduleId,
  panelProps,
}: ModuleSettingsPanelHostProps) {
  const entry = moduleSettingsPanelLoaders.find((row) => row.moduleId === moduleId)
  if (!entry) {
    return (
      <p className="layout-muted">
        No settings panel registered for <code>{moduleId}</code>.
      </p>
    )
  }
  const Panel = await entry.load()
  return <Panel {...(panelProps ?? {})} />
}

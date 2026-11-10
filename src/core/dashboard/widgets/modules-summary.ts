/**
 * Installed-catalog counts for Dashboard `modules.summary`.
 * Allowlisted = present in this build. Disabled = allowlisted and toggled off.
 */

export type ModuleSummaryCounts = {
  enabled: number
  allowlisted: number
  disabled: number
}

export function summarizeModuleCatalog(
  items: ReadonlyArray<{ enabled: boolean }>,
): ModuleSummaryCounts {
  const allowlisted = items.length
  let enabled = 0
  for (const item of items) {
    if (item.enabled) enabled += 1
  }
  return {
    enabled,
    allowlisted,
    disabled: allowlisted - enabled,
  }
}

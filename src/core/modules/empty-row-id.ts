/**
 * Stable empty-row ids shared by the layout canvas and the form canvas.
 * One helper so normalize-on-load does not remount either canvas, and so
 * forms do not keep a second copy of the id rule.
 */

export function nextEmptyRowId(sectionId: string, usedIds: Set<string>): string {
  const base = `${sectionId}__empty-row`
  if (!usedIds.has(base)) return base
  let n = 2
  while (usedIds.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

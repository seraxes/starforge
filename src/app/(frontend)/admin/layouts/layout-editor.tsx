'use client'

import React, { useActionState, useCallback, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { AccessTagsField } from '@/components/admin/AccessTagsField'
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog'
import { GantryBarRemoveButton } from '@/components/admin/GantryBarRemoveButton'
import { resolveAccessTags } from '@/core/acl/nav-access'
import type { UserGroupOption } from '@/core/acl/types'
import {
  addLayoutRowAction,
  addLayoutSectionAction,
  copySectionFromParentAction,
  copySlotFromParentAction,
  dropParticleIntoRowAction,
  moveSlotToRowAction,
  removeLayoutRowAction,
  removeLayoutSectionAction,
  stackSlotAsRowAction,
  removeSlotAction,
  renameLayoutSlotAction,
  reorderLayoutRowsAction,
  reorderLayoutSectionsAction,
  reorderRowSlotsAction,
  resetLayoutToDefaultAction,
  resizeAdjacentSlotsAction,
  setSectionInheritModeAction,
  setSlotAccessTagsAction,
  setSlotInheritModeAction,
  toggleSlotAction,
  updateLayoutSectionMetaAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import { LayoutIdField, useLayoutOutlineId } from './layout-outline-context'
import {
  clampGridWidth,
  LAYOUT_WIDTH_FULL,
  LAYOUT_WIDTH_MIN,
  pairMosaicSectionWidths,
  widthToPercentLabel,
} from '@/core/modules/grid'
import {
  CanvasRows,
  CanvasSectionFrame,
  useCanvasSectionListDrag,
  type CanvasRowModel,
  type SectionDragBind,
} from '../canvas/section-row-canvas'
import {
  DND_LAYOUT_PARTICLE,
  moveIdInOrder,
  type CanvasItemDrag,
} from '../canvas/section-row-drag'
import { sortLayoutSectionsByOrder } from '@/core/modules/section-order'
import { cssColorToColorInputValue } from '@/core/modules/styles'
import type { LayoutDocument, LayoutRow, LayoutSection, LayoutSlot } from '@/core/modules/types'

import { useAdminToast } from '../admin-toast'
import { InheritCopyRow } from './layout-inherit-controls'
import { ParticleAttributesEditor } from './particle-attributes-editor'
import { ParticleEditorHost } from './particle-editor-host'
import { ParticleSettingsPopover } from './particle-settings-popover'
import type { FormDefinitionOption, NavMenuOption } from './typed-particle-editors'

/** Structure inherit for a section id against the raw (editable) child doc. */
function rawSectionStructureInherited(
  raw: LayoutDocument | undefined,
  canInherit: boolean,
  sectionId: string,
): boolean {
  if (!canInherit || !raw) return false
  // Live inherit only when this outline has a parent link (usually Base).
  const parent = typeof raw.inheritFrom === 'string' ? raw.inheritFrom.trim() : ''
  if (!parent) return false
  const child = raw.sections.find((s) => s.id === sectionId)
  if (!child) return true
  return child.inheritMode === 'inherit'
}

function parentHasSlot(
  parent: LayoutDocument | null | undefined,
  sectionId: string,
  slotId: string,
): boolean {
  const section = parent?.sections.find((s) => s.id === sectionId)
  if (!section) return false
  return section.rows.some((row) => row.slots.some((slot) => slot.id === slotId))
}

function rawSlotInherited(
  raw: LayoutDocument | undefined,
  sectionId: string,
  rowId: string,
  slotId: string,
): boolean {
  const section = raw?.sections.find((s) => s.id === sectionId)
  const row = section?.rows.find((r) => r.id === rowId)
  const slot = row?.slots.find((s) => s.id === slotId)
  return slot?.inheritMode === 'inherit'
}

type ModuleOption = {
  id: string
  name: string
  description: string
  builtin: boolean
  defaultWidth: number
}

type Props = {
  /** Resolved (merged) document for canvas display. */
  document: LayoutDocument
  /** Raw child document — inherit mode source of truth for edits. */
  rawDocument?: LayoutDocument
  /** Resolved parent outline when inheritFrom is set. */
  parentDocument?: LayoutDocument | null
  parentLayoutId?: string | null
  source: 'database' | 'default-json'
  modules: ModuleOption[]
  /** Users → Groups options for slot accessTags multi-select. */
  groups: UserGroupOption[]
  /** Nav manager menu sets for Menu particle picker. */
  navMenus?: NavMenuOption[]
  /** Form definitions for Form particle picker (when Forms module is on). */
  formDefinitions?: FormDefinitionOption[]
  /** Site Settings → Modules → Forms product toggle. */
  formsModuleEnabled?: boolean
  primaryNavMenuId?: string
  layoutId: string
  layoutLabel: string
  /**
   * Outline-gated Inherit/Copy: false on skin Base, true on any other outline.
   * Not skin-gated — Base vs other outline only.
   */
  canInheritOutline?: boolean
}

const initialState: LayoutActionState = {}

function withOutlineId(fd: FormData, layoutId: string): FormData {
  fd.set('layoutId', layoutId)
  return fd
}


function ActionFeedback({ state }: { state: LayoutActionState }) {
  if (state.error) {
    return (
      <p className="admin-inline-error" role="alert">
        {state.error}
      </p>
    )
  }
  if (state.ok && state.message) {
    return (
      <p className="admin-inline-ok" role="status">
        {state.message}
      </p>
    )
  }
  return null
}

function ParticleConfigTab({
  sectionId,
  rowId,
  slot,
  navMenus,
  formDefinitions,
  formsModuleEnabled,
  primaryNavMenuId,
  onSlotPatched,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  navMenus: NavMenuOption[]
  formDefinitions: FormDefinitionOption[]
  formsModuleEnabled: boolean
  primaryNavMenuId: string
  onSlotPatched?: (patch: Partial<LayoutSlot>) => void
}) {
  const attrs = (
    <ParticleAttributesEditor
      sectionId={sectionId}
      rowId={rowId}
      slot={slot}
      onAttrsSaved={(next) =>
        onSlotPatched?.({
          htmlId: next.htmlId,
          cssClass: next.cssClass,
        } as Partial<LayoutSlot>)
      }
    />
  )

  return (
    <div className="gantry-particle-config-stack">
      {attrs}
      <ParticleEditorHost
        sectionId={sectionId}
        rowId={rowId}
        slot={slot}
        navMenus={navMenus}
        formDefinitions={formDefinitions}
        formsModuleEnabled={formsModuleEnabled}
        primaryNavMenuId={primaryNavMenuId}
        embedded
        onConfigSaved={(config) => onSlotPatched?.({ config })}
      />
    </div>
  )
}

function sortSections(sections: LayoutSection[]) {
  // User DnD order only — do not apply public footer-partition / semantic bands.
  return sortLayoutSectionsByOrder(sections)
}

function sortRows(rows: LayoutRow[]) {
  return [...rows].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
}

function sortSlots(slots: LayoutSlot[]) {
  return [...slots].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
}

/** Section / row / slot id topology — used to soft-merge server refreshes without remounting open cogs. */
function layoutStructureKey(sections: LayoutSection[]): string {
  return sortSections(sections)
    .map((section) => {
      const rows = sortRows(section.rows)
        .map((row) => `${row.id}:${sortSlots(row.slots).map((s) => s.id).join(',')}`)
        .join('+')
      return `${section.id}{${rows}}`
    })
    .join('|')
}

/**
 * When autosave revalidates the layout document, keep the same section/row/slot topology
 * and merge fields onto the existing tree. A wholesale replace remounts particle cogs mid-type.
 */
function mergeSectionsFromServer(prev: LayoutSection[], next: LayoutSection[]): LayoutSection[] {
  const sortedNext = sortSections(next)
  if (layoutStructureKey(prev) !== layoutStructureKey(sortedNext)) {
    return sortedNext
  }
  return sortSections(prev).map((prevSection) => {
    const serverSection = sortedNext.find((s) => s.id === prevSection.id)!
    return {
      ...prevSection,
      ...serverSection,
      rows: sortRows(prevSection.rows).map((prevRow) => {
        const serverRow = sortRows(serverSection.rows).find((r) => r.id === prevRow.id)!
        return {
          ...prevRow,
          ...serverRow,
          slots: sortSlots(prevRow.slots).map((prevSlot) => {
            const serverSlot = sortSlots(serverRow.slots).find((s) => s.id === prevSlot.id)!
            return { ...prevSlot, ...serverSlot }
          }),
        }
      }),
    }
  })
}

function ParticleBlock({
  sectionId,
  rowId,
  slot,
  modules,
  groups,
  navMenus,
  formDefinitions,
  formsModuleEnabled,
  primaryNavMenuId,
  onSlotPatched,
  canInherit,
  particleInherited,
  parentHasMatchingSlot,
  sectionStructureInherited,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  modules: ModuleOption[]
  groups: UserGroupOption[]
  navMenus: NavMenuOption[]
  formDefinitions: FormDefinitionOption[]
  formsModuleEnabled: boolean
  primaryNavMenuId: string
  onSlotPatched?: (patch: Partial<LayoutSlot>) => void
  canInherit: boolean
  particleInherited: boolean
  parentHasMatchingSlot: boolean
  sectionStructureInherited: boolean
}) {
  const router = useRouter()
  const layoutId = useLayoutOutlineId()
  const { notifySaved, notifyError } = useAdminToast()
  const [pending, startTransition] = useTransition()
  const [flash, setFlash] = useState<LayoutActionState>({})
  const meta = modules.find((m) => m.id === slot.moduleId)
  const catalogName = meta?.name ?? slot.moduleId
  const displayName = slot.name?.trim() || catalogName
  const enabled = slot.enabled !== false
  const pctLabel = widthToPercentLabel(slot.width)
  const accessTags = resolveAccessTags({
    accessTags: slot.accessTags,
    accessLevel: slot.accessLevel,
  })
  const accessSummary =
    accessTags.length === 1 && accessTags[0] === 'public'
      ? null
      : accessTags.map((t) => (t.startsWith('group:') ? t.slice('group:'.length) : t)).join(', ')

  const persistAccessTags = useCallback(
    (next: string[]) => {
      const fd = withOutlineId(new FormData(), layoutId)
      fd.set('sectionId', sectionId)
      fd.set('rowId', rowId)
      fd.set('slotId', slot.id)
      fd.set('accessTags', JSON.stringify(next.length ? next : ['public']))
      startTransition(async () => {
        const result = await setSlotAccessTagsAction({}, fd)
        setFlash(result)
        router.refresh()
      })
    },
    [layoutId, rowId, router, sectionId, slot.id],
  )

  const persistName = useCallback(
    (nextRaw: string) => {
      const next = nextRaw.trim()
      const prev = (slot.name ?? '').trim()
      if (next === prev) return
      const fd = withOutlineId(new FormData(), layoutId)
      fd.set('sectionId', sectionId)
      fd.set('rowId', rowId)
      fd.set('slotId', slot.id)
      fd.set('name', next)
      startTransition(async () => {
        const result = await renameLayoutSlotAction({}, fd)
        setFlash(result)
        router.refresh()
      })
    },
    [layoutId, rowId, router, sectionId, slot.id, slot.name],
  )

  return (
    <header className="gantry-slot-head">
        <div className="gantry-slot-title">
          <span
            className="gantry-slot-handle"
            aria-hidden="true"
            title="Drag this bar to move it"
          >
            ▣
          </span>
          <div className="gantry-slot-labels">
            <label className="gantry-inline-label gantry-slot-name-label">
              <span className="sr-only">Particle display name</span>
              <input
                key={`slot-name-${slot.id}-${slot.name ?? ''}`}
                type="text"
                className="gantry-inline-input gantry-slot-name-input"
                defaultValue={slot.name ?? ''}
                placeholder={catalogName}
                disabled={pending}
                draggable={false}
                title="Display name. Drag the whole bar to move it."
                aria-label={`Display name for ${catalogName}`}
                onBlur={(event) => persistName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    ;(event.target as HTMLInputElement).blur()
                  }
                }}
              />
            </label>
            <span className="gantry-slot-sub">
              {slot.moduleId}
              {!enabled ? ' · off' : ''}
              {accessSummary ? ` · ${accessSummary}` : ''}
              {' · drag bar to move'}
            </span>
          </div>
        </div>
        <div
          className="gantry-slot-end"
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span className="gantry-slot-pct" title={`Width ${pctLabel} (min ${LAYOUT_WIDTH_MIN}%)`}>
            {pctLabel}
          </span>
          <div className="gantry-slot-actions">
            <ParticleSettingsPopover
              title={`${displayName} settings`}
              tabs={[
                {
                  id: 'config',
                  label: 'Config',
                  content: (
                    <ParticleConfigTab
                      sectionId={sectionId}
                      rowId={rowId}
                      slot={slot}
                      navMenus={navMenus}
                      formDefinitions={formDefinitions}
                      formsModuleEnabled={formsModuleEnabled}
                      primaryNavMenuId={primaryNavMenuId}
                      onSlotPatched={onSlotPatched}
                    />
                  ),
                },
                {
                  id: 'access',
                  label: 'Access',
                  content: (
                    <AccessTagsField
                      className="gantry-slot-access-tags"
                      value={accessTags}
                      groups={groups}
                      disabled={pending || sectionStructureInherited || particleInherited}
                      onChange={persistAccessTags}
                    />
                  ),
                },
                ...(canInherit
                  ? [
                      {
                        id: 'inheritance',
                        label: 'Inheritance',
                        content: (
                          <div className="gantry-slot-inherit-panel">
                            {sectionStructureInherited ? (
                              <p className="settings-hint">
                                Section inherits structure from the parent outline. Copy or turn off
                                section inherit first to manage particle inherit.
                              </p>
                            ) : parentHasMatchingSlot ? (
                              <InheritCopyRow
                                inherited={particleInherited}
                                disabled={pending}
                                onInheritChange={(next) => {
                                  const fd = withOutlineId(new FormData(), layoutId)
                                  fd.set('sectionId', sectionId)
                                  fd.set('rowId', rowId)
                                  fd.set('slotId', slot.id)
                                  fd.set('inheritMode', next ? 'inherit' : 'local')
                                  startTransition(async () => {
                                    const result = await setSlotInheritModeAction({}, fd)
                                    setFlash(result)
                                    if (result.ok) notifySaved('Saved')
                                    else if (result.error) notifyError(result.error)
                                    router.refresh()
                                  })
                                }}
                                onCopy={() => {
                                  const fd = withOutlineId(new FormData(), layoutId)
                                  fd.set('sectionId', sectionId)
                                  fd.set('rowId', rowId)
                                  fd.set('slotId', slot.id)
                                  startTransition(async () => {
                                    const result = await copySlotFromParentAction({}, fd)
                                    setFlash(result)
                                    if (result.ok) notifySaved('Copied')
                                    else if (result.error) notifyError(result.error)
                                    router.refresh()
                                  })
                                }}
                                hint="Inherit keeps a live link to the parent particle. Copy snapshots it locally."
                              />
                            ) : (
                              <p className="settings-hint">
                                Parent outline has no matching particle id in this section.
                              </p>
                            )}
                            <ActionFeedback state={flash} />
                          </div>
                        ),
                      },
                    ]
                  : []),
                {
                  id: 'particle',
                  label: 'Particle',
                  content: (
                    <div className="gantry-slot-extra-actions">
                      <button
                        type="button"
                        className="secondary"
                        disabled={pending || sectionStructureInherited}
                        onClick={() => {
                          const fd = withOutlineId(new FormData(), layoutId)
                          fd.set('sectionId', sectionId)
                          fd.set('rowId', rowId)
                          fd.set('slotId', slot.id)
                          startTransition(async () => {
                            const result = await toggleSlotAction({}, fd)
                            setFlash(result)
                            router.refresh()
                          })
                        }}
                      >
                        {enabled ? 'Disable' : 'Enable'}
                      </button>
                      <ActionFeedback state={flash} />
                    </div>
                  ),
                },
              ]}
            />
            <GantryBarRemoveButton
              label={`Remove ${displayName}`}
              confirmMessage={`Remove “${displayName}” from this layout?`}
              disabled={pending}
              onConfirm={() => {
                const fd = withOutlineId(new FormData(), layoutId)
                fd.set('sectionId', sectionId)
                fd.set('rowId', rowId)
                fd.set('slotId', slot.id)
                startTransition(async () => {
                  const result = await removeSlotAction({}, fd)
                  setFlash(result)
                  router.refresh()
                })
              }}
            />
          </div>
        </div>
      </header>
  )
}

function SectionCanvas({
  section,
  modules,
  groups,
  navMenus,
  formDefinitions,
  formsModuleEnabled,
  primaryNavMenuId,
  canRemoveSection,
  drag,
  onSectionRemoved,
  canInherit,
  rawDocument,
  parentDocument,
}: {
  section: LayoutSection
  modules: ModuleOption[]
  groups: UserGroupOption[]
  navMenus: NavMenuOption[]
  formDefinitions: FormDefinitionOption[]
  formsModuleEnabled: boolean
  primaryNavMenuId: string
  canRemoveSection: boolean
  drag: SectionDragBind
  onSectionRemoved: (sectionId: string) => void
  canInherit: boolean
  rawDocument?: LayoutDocument
  parentDocument?: LayoutDocument | null
}) {
  const router = useRouter()
  const layoutId = useLayoutOutlineId()
  const [metaPending, startMetaSave] = useTransition()
  const [metaFlash, setMetaFlash] = useState<LayoutActionState>({})
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false)
  const { notifySaved, notifyError } = useAdminToast()
  const structureInherited = rawSectionStructureInherited(
    rawDocument,
    canInherit,
    section.id,
  )
  const parentHasSection = Boolean(
    parentDocument?.sections.some((s) => s.id === section.id),
  )
  const [localRows, setLocalRows] = useState<LayoutRow[]>(() => sortRows(section.rows))
  const [rowOrderSource, setRowOrderSource] = useState(section)
  const [slotMap, setSlotMap] = useState<Record<string, LayoutSlot[]>>(() => {
    const map: Record<string, LayoutSlot[]> = {}
    for (const row of section.rows) map[row.id] = sortSlots(row.slots)
    return map
  })
  const [slotMapSource, setSlotMapSource] = useState(section)
  const [rowNotices, setRowNotices] = useState<Record<string, LayoutActionState>>({})

  const rows = localRows
  const [rowPending, startRowTransition] = useTransition()

  const persistAddEmptyRow = useCallback(() => {
    const fd = withOutlineId(new FormData(), layoutId)
    fd.set('sectionId', section.id)
    startRowTransition(async () => {
      await addLayoutRowAction({}, fd)
      router.refresh()
    })
  }, [layoutId, router, section.id])

  const rowRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRowRefresh = useCallback(() => {
    if (rowRefreshTimerRef.current) clearTimeout(rowRefreshTimerRef.current)
    rowRefreshTimerRef.current = setTimeout(() => {
      rowRefreshTimerRef.current = null
      router.refresh()
    }, 500)
  }, [router])

  const persistRowOrder = useCallback(
    (ordered: LayoutRow[]) => {
      const fd = withOutlineId(new FormData(), layoutId)
      fd.set('sectionId', section.id)
      fd.set('orderJson', JSON.stringify(ordered.map((r) => r.id)))
      startRowTransition(async () => {
        const result = await reorderLayoutRowsAction({}, fd)
        if (result.error) notifyError(result.error)
        scheduleRowRefresh()
      })
    },
    [layoutId, notifyError, scheduleRowRefresh, section.id],
  )

  const persistRemoveEmptyRow = useCallback(
    (rowId: string) => {
      const fd = withOutlineId(new FormData(), layoutId)
      fd.set('sectionId', section.id)
      fd.set('rowId', rowId)
      startRowTransition(async () => {
        const result = await removeLayoutRowAction({}, fd)
        setRowNotices((prev) => ({ ...prev, [rowId]: result }))
        router.refresh()
      })
    },
    [layoutId, router, section.id],
  )

  const persistDrop = useCallback(
    (rowId: string, moduleId: string) => {
      const fd = withOutlineId(new FormData(), layoutId)
      fd.set('sectionId', section.id)
      fd.set('rowId', rowId)
      fd.set('moduleId', moduleId)
      startRowTransition(async () => {
        const result = await dropParticleIntoRowAction({}, fd)
        setRowNotices((prev) => ({ ...prev, [rowId]: result }))
        router.refresh()
      })
    },
    [layoutId, router, section.id],
  )

  const persistSlotOrder = useCallback(
    (rowId: string, ordered: LayoutSlot[]) => {
      const fd = withOutlineId(new FormData(), layoutId)
      fd.set('sectionId', section.id)
      fd.set('rowId', rowId)
      fd.set('orderJson', JSON.stringify(ordered.map((s) => s.id)))
      startRowTransition(async () => {
        await reorderRowSlotsAction({}, fd)
        scheduleRowRefresh()
      })
    },
    [layoutId, scheduleRowRefresh, section.id],
  )

  const persistMoveSlot = useCallback(
    (rowId: string, payload: CanvasItemDrag, index?: number) => {
      const fd = withOutlineId(new FormData(), layoutId)
      fd.set('sourceSectionId', payload.sectionId)
      fd.set('sourceRowId', payload.rowId)
      fd.set('slotId', payload.itemId)
      fd.set('targetSectionId', section.id)
      fd.set('targetRowId', rowId)
      if (index != null) fd.set('index', String(index))
      startRowTransition(async () => {
        const result = await moveSlotToRowAction({}, fd)
        if (result.error) setRowNotices((prev) => ({ ...prev, [rowId]: result }))
        scheduleRowRefresh()
      })
    },
    [layoutId, scheduleRowRefresh, section.id],
  )

  const persistResize = useCallback(
    (rowId: string, leftId: string, rightId: string, leftWidth: number, rightWidth: number) => {
      const fd = withOutlineId(new FormData(), layoutId)
      fd.set('sectionId', section.id)
      fd.set('rowId', rowId)
      fd.set('leftSlotId', leftId)
      fd.set('rightSlotId', rightId)
      fd.set('leftWidth', String(leftWidth))
      startRowTransition(async () => {
        const result = await resizeAdjacentSlotsAction({}, fd)
        setRowNotices((prev) => ({ ...prev, [rowId]: result }))
        setSlotMap((prev) => ({
          ...prev,
          [rowId]: (prev[rowId] ?? []).map((slot) => {
            if (slot.id === leftId) return { ...slot, width: leftWidth }
            if (slot.id === rightId) return { ...slot, width: rightWidth }
            return slot
          }),
        }))
        router.refresh()
      })
    },
    [layoutId, router, section.id],
  )

  /**
   * Particle stack (horizontal blue line): prefer instant local row reorder when
   * the dragged particle is alone in its row; otherwise persist via server action.
   */
  const handleParticleStack = useCallback(
    (payload: CanvasItemDrag, targetRowId: string, position: 'before' | 'after') => {
      const sameSection = payload.sectionId === section.id
      const sourceSlots = sameSection
        ? slotMap[payload.rowId] ??
          localRows.find((r) => r.id === payload.rowId)?.slots ??
          []
        : []
      const soloInSection = sameSection && sortSlots(sourceSlots).length === 1

      if (soloInSection) {
        const sorted = sortRows(localRows)
        const targetIndex = sorted.findIndex((r) => r.id === targetRowId)
        const fromIndex = sorted.findIndex((r) => r.id === payload.rowId)
        if (targetIndex < 0 || fromIndex < 0) return
        const destIndex = position === 'before' ? targetIndex : targetIndex + 1
        if (destIndex === fromIndex || destIndex === fromIndex + 1) return
        const moved = moveIdInOrder(sorted, payload.rowId, destIndex, (row) => row.id)
        const next = moved.map((row, index) => ({ ...row, order: index }))
        setLocalRows(next)
        persistRowOrder(next)
        return
      }

      const fd = withOutlineId(new FormData(), layoutId)
      fd.set('sourceSectionId', payload.sectionId)
      fd.set('sourceRowId', payload.rowId)
      fd.set('slotId', payload.itemId)
      fd.set('targetSectionId', section.id)
      fd.set('targetRowId', targetRowId)
      fd.set('position', position)
      startRowTransition(async () => {
        const result = await stackSlotAsRowAction({}, fd)
        if (result.error) notifyError(result.error)
        scheduleRowRefresh()
      })
    },
    [layoutId, localRows, notifyError, persistRowOrder, scheduleRowRefresh, section.id, slotMap],
  )

  // Soft-merge slot rows when the server section refreshes (autosave) — keep topology stable.
  if (section !== slotMapSource) {
    setSlotMapSource(section)
    setSlotMap((prev) => {
      const map: Record<string, LayoutSlot[]> = {}
      for (const row of section.rows) {
        const serverSlots = sortSlots(row.slots)
        const local = prev[row.id]
        if (
          local &&
          local.length === serverSlots.length &&
          local.every((slot, index) => slot.id === serverSlots[index]!.id)
        ) {
          map[row.id] = local.map((slot, index) => ({ ...slot, ...serverSlots[index]! }))
        } else {
          map[row.id] = serverSlots
        }
      }
      return map
    })
  }

  // Soft-merge row order: keep local order when id set matches; otherwise take server order.
  if (section !== rowOrderSource) {
    setRowOrderSource(section)
    setLocalRows((prev) => {
      const server = sortRows(section.rows)
      if (
        prev.length === server.length &&
        prev.every((row, index) => row.id === server[index]!.id)
      ) {
        return prev.map((row, index) => ({ ...row, ...server[index]! }))
      }
      const prevById = new Map(prev.map((row) => [row.id, row]))
      if (
        prev.length === server.length &&
        server.every((row) => prevById.has(row.id))
      ) {
        // Same rows, possibly reordered on server — prefer local order until refresh settles.
        return prev.map((row) => {
          const next = server.find((s) => s.id === row.id)!
          return { ...row, ...next }
        })
      }
      return server
    })
  }


  const persistSectionMeta = useCallback(
    (fields: {
      label?: string
      cssClass?: string
      containerMode?: 'full' | 'boxed'
      width?: number
      backgroundColor?: string
      textColor?: string
    }) => {
      const fd = withOutlineId(new FormData(), layoutId)
      fd.set('sectionId', section.id)
      let changed = false
      if (fields.label !== undefined) {
        const next = fields.label.trim()
        if (!next) {
          // Revert empty label in the uncontrolled input via remount key on refresh/no-op.
          return
        }
        if (next !== section.label) {
          fd.set('label', next)
          changed = true
        }
      }
      if (fields.cssClass !== undefined) {
        const next = fields.cssClass.trim()
        const prev = (section.cssClass ?? '').trim()
        if (next !== prev) {
          fd.set('cssClass', next)
          changed = true
        }
      }
      if (fields.containerMode !== undefined) {
        const prev = section.containerMode ?? 'full'
        if (fields.containerMode !== prev) {
          fd.set('containerMode', fields.containerMode)
          changed = true
        }
      }
      if (fields.width !== undefined) {
        const next = clampGridWidth(fields.width, LAYOUT_WIDTH_FULL)
        const prev = clampGridWidth(section.width ?? LAYOUT_WIDTH_FULL, LAYOUT_WIDTH_FULL)
        if (next !== prev) {
          fd.set('width', String(next))
          changed = true
        }
      }
      if (fields.backgroundColor !== undefined) {
        const next = fields.backgroundColor.trim()
        const prev = (section.styles?.backgroundColor ?? '').trim()
        if (next !== prev) {
          fd.set('backgroundColor', next)
          changed = true
        }
      }
      if (fields.textColor !== undefined) {
        const next = fields.textColor.trim()
        const prev = (section.styles?.textColor ?? '').trim()
        if (next !== prev) {
          fd.set('textColor', next)
          changed = true
        }
      }
      if (!changed) return
      startMetaSave(async () => {
        const result = await updateLayoutSectionMetaAction({}, fd)
        setMetaFlash(result)
        if (result.ok) notifySaved('Saved')
        else if (result.error) notifyError(result.error)
        router.refresh()
      })
    },
    [
      layoutId,
      notifyError,
      notifySaved,
      router,
      section.containerMode,
      section.cssClass,
      section.id,
      section.label,
      section.width,
      section.styles?.backgroundColor,
      section.styles?.textColor,
    ],
  )

  const sectionWidth = clampGridWidth(section.width ?? LAYOUT_WIDTH_FULL, LAYOUT_WIDTH_FULL)
  const canvasRows: CanvasRowModel[] = rows.map((row) => ({
    id: row.id,
    items: sortSlots(slotMap[row.id] ?? row.slots).map((slot) => ({
      id: slot.id,
      width: slot.width,
    })),
  }))

  return (
    <CanvasSectionFrame
      sectionId={section.id}
      label={section.label}
      width={sectionWidth}
      className={structureInherited ? 'sf-inherited-muted' : ''}
      drag={drag}
      labelDisabled={metaPending}
      labelRequired
      onLabelBlur={(next) => persistSectionMeta({ label: next })}
      onWidthBlur={(next) => persistSectionMeta({ width: next })}
      identityStart={
        structureInherited ? (
          <span className="gantry-inherit-badge" title="Structure inherited from parent outline">
            Inherited
          </span>
        ) : null
      }
      headEnd={
        <>
          {canInherit ? (
            parentHasSection ? (
              <InheritCopyRow
                inline
                inherited={structureInherited}
                disabled={metaPending}
                onInheritChange={(next) => {
                  const fd = withOutlineId(new FormData(), layoutId)
                  fd.set('sectionId', section.id)
                  fd.set('inheritMode', next ? 'inherit' : 'local')
                  startMetaSave(async () => {
                    const result = await setSectionInheritModeAction({}, fd)
                    setMetaFlash(result)
                    if (result.ok) notifySaved('Saved')
                    else if (result.error) notifyError(result.error)
                    router.refresh()
                  })
                }}
                onCopy={() => {
                  const fd = withOutlineId(new FormData(), layoutId)
                  fd.set('sectionId', section.id)
                  startMetaSave(async () => {
                    const result = await copySectionFromParentAction({}, fd)
                    setMetaFlash(result)
                    if (result.ok) notifySaved('Copied')
                    else if (result.error) notifyError(result.error)
                    router.refresh()
                  })
                }}
              />
            ) : (
              <span
                className="settings-hint gantry-section-inherit-missing"
                title={`Parent outline has no section with id ${section.id}`}
              >
                No parent section
              </span>
            )
          ) : null}
          {canRemoveSection ? (
            <div className="gantry-section-actions">
              <button
                type="button"
                className="gantry-toolbar-btn danger"
                title="Remove this section and everything inside it"
                disabled={metaPending}
                onClick={() => setRemoveConfirmOpen(true)}
              >
                Remove section
              </button>
              <AdminConfirmDialog
                open={removeConfirmOpen}
                title={`Remove section “${section.label}”?`}
                message="WARNING: Everything inside this section (all rows and particles) will be permanently lost."
                confirmLabel="OK"
                cancelLabel="Cancel"
                danger
                onCancel={() => setRemoveConfirmOpen(false)}
                onConfirm={() => {
                  setRemoveConfirmOpen(false)
                  const fd = withOutlineId(new FormData(), layoutId)
                  fd.set('sectionId', section.id)
                  startMetaSave(async () => {
                    const result = await removeLayoutSectionAction({}, fd)
                    setMetaFlash(result)
                    if (result.error) {
                      notifyError(result.error)
                      return
                    }
                    onSectionRemoved(section.id)
                    router.refresh()
                  })
                }}
              />
            </div>
          ) : null}
          <details className="gantry-section-settings">
            <summary
              className="gantry-section-icon-btn"
              title="Section settings"
              aria-label="Section settings"
            >
              ⚙
            </summary>
            <div className="gantry-section-toolbar">
              <label className="gantry-inline-label gantry-section-container-label">
                <span className="gantry-field-hint">Container</span>
                <select
                  key={`section-container-${section.id}-${section.containerMode ?? 'unset'}`}
                  className="gantry-inline-input gantry-section-container-select"
                  defaultValue={section.containerMode ?? ''}
                  disabled={metaPending}
                  title="Section owns container width (boxed uses outline --sf-container-max). Editable on inherit stubs."
                  aria-label="Section container width"
                  onChange={(event) => {
                    const raw = event.target.value
                    const next = raw === 'boxed' ? 'boxed' : raw === 'full' ? 'full' : undefined
                    if (!next) return
                    persistSectionMeta({ containerMode: next })
                  }}
                >
                  <option value="" disabled>
                    {section.containerMode ? '—' : 'Page default'}
                  </option>
                  <option value="full">Full width</option>
                  <option value="boxed">Boxed width</option>
                </select>
              </label>
              <div className="gantry-section-styles" role="group" aria-label="Section styles">
                <label className="gantry-inline-label gantry-section-color-label">
                  <span className="gantry-field-hint">Background</span>
                  <span className="gantry-color-field">
                    <input
                      key={`section-bg-swatch-${section.id}-${section.styles?.backgroundColor ?? ''}`}
                      type="color"
                      className="gantry-color-swatch"
                      value={cssColorToColorInputValue(section.styles?.backgroundColor)}
                      disabled={metaPending}
                      title="Section background color"
                      aria-label="Section background color picker"
                      onChange={(event) =>
                        persistSectionMeta({ backgroundColor: event.target.value })
                      }
                    />
                    <input
                      key={`section-bg-hex-${section.id}-${section.styles?.backgroundColor ?? ''}`}
                      type="text"
                      className="gantry-inline-input gantry-section-color-input"
                      defaultValue={section.styles?.backgroundColor ?? ''}
                      disabled={metaPending}
                      placeholder="#18191c"
                      spellCheck={false}
                      autoComplete="off"
                      title="Hex background (empty = inherit). Image/overlay on Styles."
                      aria-label="Section background hex"
                      onBlur={(event) =>
                        persistSectionMeta({ backgroundColor: event.target.value })
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          ;(event.target as HTMLInputElement).blur()
                        }
                      }}
                    />
                  </span>
                </label>
                <label className="gantry-inline-label gantry-section-color-label">
                  <span className="gantry-field-hint">Text</span>
                  <span className="gantry-color-field">
                    <input
                      key={`section-text-swatch-${section.id}-${section.styles?.textColor ?? ''}`}
                      type="color"
                      className="gantry-color-swatch"
                      value={cssColorToColorInputValue(section.styles?.textColor)}
                      disabled={metaPending}
                      title="Section text color"
                      aria-label="Section text color picker"
                      onChange={(event) => persistSectionMeta({ textColor: event.target.value })}
                    />
                    <input
                      key={`section-text-hex-${section.id}-${section.styles?.textColor ?? ''}`}
                      type="text"
                      className="gantry-inline-input gantry-section-color-input"
                      defaultValue={section.styles?.textColor ?? ''}
                      disabled={metaPending}
                      placeholder="#ffffff"
                      spellCheck={false}
                      autoComplete="off"
                      title="Hex text color (empty = inherit)"
                      aria-label="Section text hex"
                      onBlur={(event) => persistSectionMeta({ textColor: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          ;(event.target as HTMLInputElement).blur()
                        }
                      }}
                    />
                  </span>
                </label>
              </div>
              <label className="gantry-inline-label gantry-section-class-label">
                <span className="gantry-field-hint">CSS classes</span>
                <input
                  key={`section-class-${section.id}-${section.cssClass ?? ''}`}
                  type="text"
                  className="gantry-inline-input gantry-section-class-input"
                  defaultValue={section.cssClass ?? ''}
                  disabled={metaPending}
                  placeholder="e.g. dark-header"
                  title="Space-separated CSS classes on the public section wrapper"
                  aria-label="Section CSS classes"
                  onBlur={(event) => persistSectionMeta({ cssClass: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      ;(event.target as HTMLInputElement).blur()
                    }
                  }}
                />
              </label>
              <code className="layout-id">{section.id}</code>
            </div>
          </details>
        </>
      }
      afterHead={<ActionFeedback state={metaFlash} />}
    >
      <CanvasRows
        sectionId={section.id}
        rows={canvasRows}
        paletteMimes={[DND_LAYOUT_PARTICLE]}
        rowsLocked={structureInherited}
        addRowDisabled={rowPending}
        emptyMetaLabel="Empty row · drop particles here · drag empty zone to reorder"
        emptyZoneLabel="Drop particles here… · drag to reorder row"
        resizeLabel="Resize particles"
        emptyMessage={
          <p className="layout-muted">Open + row to drop particles, or drag onto a new empty row.</p>
        }
        rowsLockedNotice={
          <p className="settings-hint gantry-section-inherit-hint">
            Structure inherited from parent — particles are read-only here. Turn inherit off or Copy
            from parent in section settings to edit.
          </p>
        }
        renderAfterRow={(rowId) => <ActionFeedback state={rowNotices[rowId] ?? {}} />}
        renderItem={(item, ctx) => {
          const slot = sortSlots(slotMap[ctx.rowId] ?? []).find((s) => s.id === item.id)
          if (!slot) return null
          return (
            <ParticleBlock
              sectionId={section.id}
              rowId={ctx.rowId}
              slot={slot}
              modules={modules}
              groups={groups}
              navMenus={navMenus}
              formDefinitions={formDefinitions}
              formsModuleEnabled={formsModuleEnabled}
              primaryNavMenuId={primaryNavMenuId}
              onSlotPatched={(patch) => {
                setSlotMap((prev) => ({
                  ...prev,
                  [ctx.rowId]: (prev[ctx.rowId] ?? []).map((s) => {
                    if (s.id !== slot.id) return s
                    const next = { ...s, ...patch }
                    if ('htmlId' in patch && !patch.htmlId) delete next.htmlId
                    if ('cssClass' in patch && !patch.cssClass) delete next.cssClass
                    return next
                  }),
                }))
              }}
              canInherit={canInherit}
              particleInherited={rawSlotInherited(rawDocument, section.id, ctx.rowId, slot.id)}
              parentHasMatchingSlot={parentHasSlot(parentDocument, section.id, slot.id)}
              sectionStructureInherited={structureInherited}
            />
          )
        }}
        itemClassName={(_item, ctx) =>
          rawSlotInherited(rawDocument, section.id, ctx.rowId, _item.id) || structureInherited
            ? 'sf-inherited-muted'
            : ''
        }
        itemDataAttrs={(item, ctx) => {
          const slot = (slotMap[ctx.rowId] ?? []).find((s) => s.id === item.id)
          return { 'data-enabled': slot?.enabled !== false ? 'true' : 'false' }
        }}
        itemTitle={(item, ctx) => {
          const slot = (slotMap[ctx.rowId] ?? []).find((s) => s.id === item.id)
          const catalog =
            modules.find((m) => m.id === slot?.moduleId)?.name ?? slot?.moduleId ?? 'particle'
          const name = slot?.name?.trim() || catalog
          return `Drag ${name} to move — blue line shows where it will land`
        }}
        onPaletteDrop={(_mime, value, rowId) => persistDrop(rowId, value)}
        onReorderItems={(rowId, orderedIds) => {
          const current = sortSlots(slotMap[rowId] ?? [])
          const byId = new Map(current.map((slot) => [slot.id, slot]))
          const next = orderedIds.flatMap((id, index) => {
            const slot = byId.get(id)
            return slot ? [{ ...slot, order: index }] : []
          })
          setSlotMap((prev) => ({ ...prev, [rowId]: next }))
          persistSlotOrder(rowId, next)
        }}
        onMoveItem={(source, rowId, index) => persistMoveSlot(rowId, source, index)}
        onStackItem={(source, rowId, position) => handleParticleStack(source, rowId, position)}
        onReorderRows={(orderedIds) => {
          const byId = new Map(rows.map((row) => [row.id, row]))
          const next = orderedIds.flatMap((id, index) => {
            const row = byId.get(id)
            return row ? [{ ...row, order: index }] : []
          })
          setLocalRows(next)
          persistRowOrder(next)
        }}
        onResize={(rowId, leftId, rightId, leftWidth, rightWidth, commit) => {
          setSlotMap((prev) => ({
            ...prev,
            [rowId]: (prev[rowId] ?? []).map((slot) => {
              if (slot.id === leftId) return { ...slot, width: leftWidth }
              if (slot.id === rightId) return { ...slot, width: rightWidth }
              return slot
            }),
          }))
          if (commit) persistResize(rowId, leftId, rightId, leftWidth, rightWidth)
        }}
        onAddEmptyRow={persistAddEmptyRow}
        onRemoveEmptyRow={persistRemoveEmptyRow}
      />
    </CanvasSectionFrame>
  )
}

/**
 * Gantry Layout Manager–style canvas:
 * 1) Create section → 2) + row opens an empty drop zone → drag particles in →
 * 3) Drop another beside it and resize by % → drag particle to reorder in-row or move →
 * 4) Drag the blue row bar to reorder vertically (stacked particle order) →
 * sections reorder via drag handle. Empty rows are opt-in (+ row / − row), not always-on.
 */
export function LayoutEditor({
  document,
  rawDocument,
  parentDocument = null,
  parentLayoutId: _parentLayoutId = null,
  source,
  modules,
  groups,
  navMenus = [],
  formDefinitions = [],
  formsModuleEnabled = true,
  primaryNavMenuId = 'main',
  layoutId,
  layoutLabel,
  canInheritOutline,
}: Props) {
  const router = useRouter()
  const outlineId = layoutId
  // Prefer explicit Base vs other outline gate from the server; fall back to inheritFrom.
  const canInherit =
    typeof canInheritOutline === 'boolean'
      ? canInheritOutline
      : Boolean(
          rawDocument?.inheritFrom &&
            String(rawDocument.inheritFrom).trim() &&
            String(rawDocument.inheritFrom).trim() !== layoutId,
        )
  const [sectionPendingSave, startSectionSave] = useTransition()
  const [sectionState, sectionAction, sectionPending] = useActionState(
    addLayoutSectionAction,
    initialState,
  )
  const [resetState, resetAction, resetPending] = useActionState(
    resetLayoutToDefaultAction,
    initialState,
  )
  const [reorderFlash, setReorderFlash] = useState<LayoutActionState>({})
  const [draggingParticleId, setDraggingParticleId] = useState<string | null>(null)

  const [sectionList, setSectionList] = useState(() => sortSections(document.sections))
  const [sectionListSource, setSectionListSource] = useState(document.sections)

  // Soft-merge when the server layout document refreshes (particle autosave revalidate).
  if (document.sections !== sectionListSource) {
    setSectionListSource(document.sections)
    setSectionList((prev) => mergeSectionsFromServer(prev, document.sections))
  }

  const persistSectionOrder = useCallback(
    (ordered: LayoutSection[], widthOverrides?: Record<string, number>) => {
      const fd = withOutlineId(new FormData(), outlineId)
      fd.set('orderJson', JSON.stringify(ordered.map((s) => s.id)))
      if (widthOverrides && Object.keys(widthOverrides).length > 0) {
        fd.set('widthsJson', JSON.stringify(widthOverrides))
      }
      startSectionSave(async () => {
        const result = await reorderLayoutSectionsAction({}, fd)
        setReorderFlash(result)
        router.refresh()
      })
    },
    [outlineId, router],
  )

  const handleSectionDrop = useCallback(
    (
      movingId: string,
      targetSectionId: string,
      position: 'before' | 'after',
      placeBeside: boolean,
    ) => {
      if (!movingId || movingId === targetSectionId) return
      const without = sectionList.filter((s) => s.id !== movingId)
      const moving = sectionList.find((s) => s.id === movingId)
      if (!moving) return
      const targetIndex = without.findIndex((s) => s.id === targetSectionId)
      if (targetIndex < 0) return
      const insertAt = position === 'before' ? targetIndex : targetIndex + 1
      let next = [...without.slice(0, insertAt), moving, ...without.slice(insertAt)].map(
        (section, index) => ({ ...section, order: index }),
      )
      let widthOverrides: Record<string, number> | undefined
      if (placeBeside) {
        const target = next.find((s) => s.id === targetSectionId)
        const mover = next.find((s) => s.id === movingId)
        const paired = pairMosaicSectionWidths(mover?.width, target?.width)
        if (paired) {
          const [moverW, targetW] = paired
          widthOverrides = { [movingId]: moverW, [targetSectionId]: targetW }
          next = next.map((section) => {
            if (section.id === movingId) return { ...section, width: moverW }
            if (section.id === targetSectionId) return { ...section, width: targetW }
            return section
          })
        }
      }
      setSectionList(next)
      persistSectionOrder(next, widthOverrides)
    },
    [persistSectionOrder, sectionList],
  )

  const sectionDrag = useCanvasSectionListDrag(handleSectionDrop)

  return (
    <div className="gantry-editor">
      <p className="layout-source">
        Source:{' '}
        <strong>{source === 'database' ? 'Database (sf_layouts)' : 'Default JSON fallback'}</strong>
        {' · outline '}
        <strong>{layoutLabel}</strong> (<code>{layoutId}</code>)
        {source === 'default-json' ? ' — first drop/save writes to Postgres.' : null}{' '}
        UX matches{' '}
        <a
          href="https://docs.gantry.org/gantry5/configure/layout-manager"
          target="_blank"
          rel="noreferrer"
        >
          Gantry Layout Manager
        </a>
        : drag <strong>⋮⋮</strong> above/below to reorder, left/right to place beside (50%|50%) ·
        section → row → drag particles · resize by % (1% steps, min 5%).
      </p>

      <div className="gantry-workspace">
        <aside className="gantry-palette" aria-label="Available particles">
          <h3>Particles</h3>
          <ul className="gantry-palette-list">
            {modules.map((mod) => (
              <li key={mod.id}>
                <div
                  className={
                    draggingParticleId === mod.id
                      ? 'gantry-palette-item is-dragging'
                      : 'gantry-palette-item'
                  }
                  draggable
                  title={mod.description || mod.id}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(DND_LAYOUT_PARTICLE, mod.id)
                    event.dataTransfer.setData('text/plain', mod.id)
                    event.dataTransfer.effectAllowed = 'copy'
                    setDraggingParticleId(mod.id)
                  }}
                  onDragEnd={() => setDraggingParticleId(null)}
                >
                  <span className="gantry-palette-icon" aria-hidden="true">
                    ▣
                  </span>
                  <span className="gantry-palette-labels">
                    <strong>{mod.name}</strong>
                    <span className="gantry-palette-key">{mod.id}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <div className="gantry-canvas" aria-label="Layout canvas">
          <div className="gantry-canvas-toolbar">
            <form action={sectionAction} className="layout-inline-form gantry-toolbar-create">
              <LayoutIdField />
              <input type="text" name="label" placeholder="New section name" required />
              <div className="gantry-section-create" role="group" aria-label="Add section">
                <button
                  type="submit"
                  className="gantry-section-create-submit"
                  disabled={sectionPending}
                >
                  {sectionPending ? (
                    'Adding…'
                  ) : (
                    <>
                      <span className="gantry-section-create-plus" aria-hidden="true">
                        +
                      </span>
                      <span>Section</span>
                    </>
                  )}
                </button>
                <label className="gantry-section-create-width">
                  <span className="sr-only">Width %</span>
                  <input
                    type="number"
                    name="width"
                    defaultValue={LAYOUT_WIDTH_FULL}
                    min={LAYOUT_WIDTH_MIN}
                    max={LAYOUT_WIDTH_FULL}
                    step={5}
                    aria-label="New section width percent"
                    title="Percent width for the new section (5–100)"
                    disabled={sectionPending}
                  />
                  <span aria-hidden="true">%</span>
                </label>
              </div>
            </form>
            <div className="gantry-canvas-toolbar-end">
              <div className="gantry-canvas-toolbar-primary">
                <Link
                  href={
                    outlineId && outlineId !== 'default'
                      ? `/admin/assigned-menu?outline=${encodeURIComponent(outlineId)}`
                      : '/admin/assigned-menu'
                  }
                  className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                  title="Assigned Menu — toggle which menu items use this outline"
                >
                  <span aria-hidden="true">⧉</span> Assigned Menu
                </Link>
                <Link
                  href="/admin/outlines"
                  className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                  title="Load / manage outlines"
                >
                  <span aria-hidden="true">⎇</span> Load
                </Link>
                <form action={resetAction} className="gantry-toolbar-clear-form">
                  <LayoutIdField />
                  <button
                    type="submit"
                    className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                    disabled={resetPending}
                    title="Reset outline to default layout"
                  >
                    <span aria-hidden="true">🗑</span>
                    {resetPending ? 'Clearing…' : 'Clear'}
                    <span aria-hidden="true" className="gantry-toolbar-caret">
                      ▾
                    </span>
                  </button>
                </form>
                <button
                  type="button"
                  className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                  title="Layout already saves on change — refresh the canvas"
                  onClick={() => router.refresh()}
                >
                  <span aria-hidden="true">↻</span> Refresh
                </button>
              </div>
              <div className="gantry-canvas-toolbar-history" role="group" aria-label="History">
                <button
                  type="button"
                  className="gantry-toolbar-btn gantry-toolbar-btn-quiet"
                  disabled
                  title="Undo (coming soon)"
                >
                  <span aria-hidden="true">↶</span> Undo
                </button>
                <button
                  type="button"
                  className="gantry-toolbar-btn gantry-toolbar-btn-quiet"
                  disabled
                  title="Redo (coming soon)"
                >
                  Redo <span aria-hidden="true">↷</span>
                </button>
              </div>
            </div>
          </div>
          <ActionFeedback state={sectionState} />
          <ActionFeedback state={resetState} />
          <ActionFeedback state={reorderFlash} />
          {sectionPendingSave ? <p className="layout-muted">Saving section order…</p> : null}

          {sectionList.length === 0 ? (
            <p className="admin-empty">No sections yet — create one to start.</p>
          ) : (
            <ol className="gantry-sections">
              {sectionList.map((section) => (
                <SectionCanvas
                  key={section.id}
                  section={section}
                  modules={modules}
                  groups={groups}
                  navMenus={navMenus}
                  formDefinitions={formDefinitions}
                  formsModuleEnabled={formsModuleEnabled}
                  primaryNavMenuId={primaryNavMenuId}
                  canRemoveSection={sectionList.length > 1}
                  drag={sectionDrag.bind(section.id)}
                  onSectionRemoved={(sectionId) => {
                    setSectionList((prev) =>
                      prev
                        .filter((s) => s.id !== sectionId)
                        .map((s, index) => ({ ...s, order: index })),
                    )
                  }}
                  canInherit={canInherit}
                  rawDocument={rawDocument}
                  parentDocument={parentDocument}
                />
              ))}
            </ol>
          )}
        </div>
      </div>

      <details className="layout-json-preview">
        <summary>Layout document (JSON storage)</summary>
        <pre>{JSON.stringify({ ...document, sections: sectionList }, null, 2)}</pre>
        <p className="layout-muted">
          Section <code>label</code> / <code>width</code> / <code>containerMode</code> / Section Styles (
          <code>backgroundColor</code> · <code>textColor</code>) / <code>cssClass</code> and slot{' '}
          <code>name</code> save on blur/change. Section <code>order</code> (and paired{' '}
          <code>width</code> when placing beside) persists on drag. Widths are integer percents
          inside the section container. Full Section Styles (image / overlay / gradients) and
          breakpoints live under Styles (<code>/admin/breakpoints</code>). See{' '}
          <code>src/core/modules/README.md</code>.
        </p>
      </details>
    </div>
  )
}

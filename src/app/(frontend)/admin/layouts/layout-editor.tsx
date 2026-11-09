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
import { layoutRowIsEmpty } from '@/core/modules/empty-rows'
import { LayoutIdField, useLayoutOutlineId } from './layout-outline-context'
import {
  clampGridWidth,
  gridColStyle,
  gridWidthPercent,
  LAYOUT_WIDTH_FULL,
  LAYOUT_WIDTH_MIN,
  mosaicParticleBarDropEdge,
  mosaicSectionDropEdge,
  pairMosaicSectionWidths,
  resizeAdjacentPair,
  widthToPercentLabel,
} from '@/core/modules/grid'
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
}

const initialState: LayoutActionState = {}

const DND_PARTICLE = 'application/x-starforge-particle'
const DND_SECTION = 'application/x-starforge-section'
/** Existing placed particle — JSON `{ sectionId, rowId, slotId }` (any section → any row). */
const DND_SLOT = 'application/x-starforge-slot'
/** Row within a section — JSON `{ sectionId, rowId }` (vertical particle stack order). */
const DND_ROW = 'application/x-starforge-row'

type RowDragPayload = {
  sectionId: string
  rowId: string
}

function encodeRowDragPayload(payload: RowDragPayload): string {
  return JSON.stringify(payload)
}

function parseRowDragPayload(raw: string): RowDragPayload | null {
  try {
    const parsed = JSON.parse(raw) as RowDragPayload
    if (
      !parsed ||
      typeof parsed.sectionId !== 'string' ||
      typeof parsed.rowId !== 'string' ||
      !parsed.sectionId.trim() ||
      !parsed.rowId.trim()
    ) {
      return null
    }
    return { sectionId: parsed.sectionId.trim(), rowId: parsed.rowId.trim() }
  } catch {
    return null
  }
}

function moveRowInOrder(rows: LayoutRow[], rowId: string, destIndex: number): LayoutRow[] {
  const from = rows.findIndex((r) => r.id === rowId)
  if (from < 0) return rows
  const next = [...rows]
  const [item] = next.splice(from, 1)
  if (!item) return rows
  let insertAt = destIndex
  if (from < destIndex) insertAt -= 1
  insertAt = Math.max(0, Math.min(insertAt, next.length))
  next.splice(insertAt, 0, item)
  return next.map((row, index) => ({ ...row, order: index }))
}

type SlotDragPayload = {
  sectionId: string
  rowId: string
  slotId: string
}

function encodeSlotDragPayload(payload: SlotDragPayload): string {
  return JSON.stringify(payload)
}

/** Interactive chrome that must not start a particle-bar drag. */
function isLayoutSlotDragIgnoredTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      'input, textarea, select, a, label, .gantry-slot-actions, .gantry-settings-trigger, .gantry-bar-remove, .gantry-settings-layer',
    ),
  )
}

/**
 * HTML5 drag image: clone of the real mid-blue particle bar at ~50% opacity.
 * Removed after the browser snapshots it. Never throws — drag must still work.
 */
function setHalfOpacityDragImage(event: React.DragEvent<HTMLElement>) {
  try {
    const src = event.currentTarget
    const rect = src.getBoundingClientRect()
    const ghost = src.cloneNode(true) as HTMLElement
    ghost.setAttribute('aria-hidden', 'true')
    ghost.style.position = 'fixed'
    ghost.style.top = '-10000px'
    ghost.style.left = '-10000px'
    ghost.style.width = `${Math.max(rect.width, 1)}px`
    ghost.style.height = `${Math.max(rect.height, 1)}px`
    ghost.style.opacity = '0.5'
    ghost.style.pointerEvents = 'none'
    ghost.style.margin = '0'
    ghost.style.zIndex = '10000'
    ghost.removeAttribute('draggable')
    document.body.appendChild(ghost)
    event.dataTransfer.setDragImage(
      ghost,
      Math.max(0, event.clientX - rect.left),
      Math.max(0, event.clientY - rect.top),
    )
    requestAnimationFrame(() => {
      requestAnimationFrame(() => ghost.remove())
    })
  } catch {
    // Browser may reject custom drag images; native drag continues.
  }
}

function parseSlotDragPayload(raw: string): SlotDragPayload | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed) as Partial<SlotDragPayload>
    if (
      typeof parsed.sectionId === 'string' &&
      parsed.sectionId &&
      typeof parsed.rowId === 'string' &&
      parsed.rowId &&
      typeof parsed.slotId === 'string' &&
      parsed.slotId
    ) {
      return {
        sectionId: parsed.sectionId,
        rowId: parsed.rowId,
        slotId: parsed.slotId,
      }
    }
  } catch {
    // Legacy: plain slot id only — cannot move across sections without path.
  }
  return null
}

function withOutlineId(fd: FormData, layoutId: string): FormData {
  fd.set('layoutId', layoutId)
  return fd
}

function dataTransferHasType(dt: DataTransfer, type: string): boolean {
  return [...dt.types].includes(type)
}

function moveSlotInOrder(
  slots: LayoutSlot[],
  slotId: string,
  destIndex: number,
): LayoutSlot[] {
  const sorted = sortSlots(slots)
  const fromIndex = sorted.findIndex((s) => s.id === slotId)
  if (fromIndex < 0) return sorted
  const next = [...sorted]
  const [moved] = next.splice(fromIndex, 1)
  let dest = destIndex
  if (fromIndex < destIndex) dest = destIndex - 1
  dest = Math.max(0, Math.min(dest, next.length))
  next.splice(dest, 0, moved)
  return next.map((slot, index) => ({ ...slot, order: index }))
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

function ResizeHandle({
  sectionId,
  rowId,
  left,
  right,
  onLocalResize,
  onCommit,
}: {
  sectionId: string
  rowId: string
  left: LayoutSlot
  right: LayoutSlot
  onLocalResize: (leftId: string, leftWidth: number, rightId: string, rightWidth: number) => void
  onCommit: (leftId: string, leftWidth: number, rightId: string, rightWidth: number) => void
}) {
  const dragging = useRef(false)

  return (
    <div
      className="gantry-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize particles"
      tabIndex={0}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const handle = event.currentTarget
        const rowEl = handle.closest('.gantry-row-slots') as HTMLElement | null
        const leftEl = handle.previousElementSibling as HTMLElement | null
        if (!rowEl || !leftEl) return
        dragging.current = true
        handle.setPointerCapture(event.pointerId)
        const pairSum = left.width + right.width
        const rowRect = rowEl.getBoundingClientRect()
        const pairLeft = leftEl.getBoundingClientRect().left - rowRect.left
        let lastLeft = left.width
        let lastRight = right.width

        const onMove = (moveEvent: PointerEvent) => {
          if (!dragging.current) return
          const x = moveEvent.clientX - rowRect.left
          // Widths are already percents; map pointer X → left % in 1% steps (5–95 when pair=100).
          const pairWidthPx = Math.max(1, (pairSum / LAYOUT_WIDTH_FULL) * rowRect.width)
          const localX = x - pairLeft
          const newLeftPercent = (localX / pairWidthPx) * pairSum
          const [lw, rw] = resizeAdjacentPair(left.width, right.width, newLeftPercent)
          lastLeft = lw
          lastRight = rw
          onLocalResize(left.id, lw, right.id, rw)
        }

        const onUp = (upEvent: PointerEvent) => {
          dragging.current = false
          handle.releasePointerCapture(upEvent.pointerId)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          onCommit(left.id, lastLeft, right.id, lastRight)
          void sectionId
          void rowId
        }

        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
      }}
    />
  )
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
  percent,
  isDragging,
  dropEdge,
  onSlotDragStart,
  onSlotDragEnd,
  onSlotDragOver,
  onSlotDrop,
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
  percent: number
  isDragging: boolean
  dropEdge: 'before' | 'after' | null
  onSlotDragStart: (payload: SlotDragPayload) => void
  onSlotDragEnd: () => void
  /** placeBeside true → left/right line; false → stack above/below the row. */
  onSlotDragOver: (
    slotId: string,
    edge: 'before' | 'after',
    placeBeside: boolean,
  ) => void
  /** Drop uses the last drag-over hint (coords on drop are unreliable). */
  onSlotDrop: (targetSlotId: string, payload: SlotDragPayload) => void
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

  const classNames = [
    'gantry-slot',
    'is-slot-grab',
    isDragging ? 'is-slot-dragging' : '',
    dropEdge === 'before' ? 'is-slot-drop-before' : '',
    dropEdge === 'after' ? 'is-slot-drop-after' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article
      className={classNames}
      data-enabled={enabled ? 'true' : 'false'}
      data-sf-width={slot.width}
      data-sf-slot={slot.id}
      draggable
      title={`Drag ${displayName} to move — blue line shows where it will land`}
      style={{
        /* Grow by % share so resize handles don't force wrap/overflow. */
        flex: `${percent} 1 0`,
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={(event) => {
        // Name field / cog / remove must not start an HTML5 drag.
        const el = event.currentTarget as HTMLElement
        el.draggable = !isLayoutSlotDragIgnoredTarget(event.target)
      }}
      onMouseUp={(event) => {
        ;(event.currentTarget as HTMLElement).draggable = true
      }}
      onMouseLeave={(event) => {
        // Restore after clicking into name/cog without a following drag.
        if (!isDragging) (event.currentTarget as HTMLElement).draggable = true
      }}
      onDragStart={(event) => {
        if (isLayoutSlotDragIgnoredTarget(event.target)) {
          event.preventDefault()
          ;(event.currentTarget as HTMLElement).draggable = true
          return
        }
        const payload: SlotDragPayload = {
          sectionId,
          rowId,
          slotId: slot.id,
        }
        event.dataTransfer.setData(DND_SLOT, encodeSlotDragPayload(payload))
        event.dataTransfer.setData('text/plain', slot.id)
        event.dataTransfer.effectAllowed = 'move'
        setHalfOpacityDragImage(event)
        onSlotDragStart(payload)
      }}
      onDragEnd={(event) => {
        ;(event.currentTarget as HTMLElement).draggable = true
        onSlotDragEnd()
      }}
      onDragOver={(event) => {
        if (!dataTransferHasType(event.dataTransfer, DND_SLOT)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
        const rect = event.currentTarget.getBoundingClientRect()
        // Band-based: top/bottom → stack row; middle → beside (wide bars ≠ section mosaic).
        const edge = mosaicParticleBarDropEdge(event.clientX, event.clientY, rect)
        onSlotDragOver(slot.id, edge.position, edge.placeBeside)
      }}
      onDrop={(event) => {
        if (!dataTransferHasType(event.dataTransfer, DND_SLOT)) return
        event.preventDefault()
        event.stopPropagation()
        const payload = parseSlotDragPayload(event.dataTransfer.getData(DND_SLOT))
        if (!payload) return
        // Honor the blue-line hint from dragover — do not recompute from drop coords.
        onSlotDrop(slot.id, payload)
      }}
    >
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
    </article>
  )
}

function DropRow({
  sectionId,
  row,
  modules,
  groups,
  navMenus,
  formDefinitions,
  formsModuleEnabled,
  primaryNavMenuId,
  localSlots,
  setLocalSlots,
  isDraggingRow,
  rowDropEdge,
  draggingSlotId,
  slotDropHint,
  onSlotDragStart,
  onSlotDragEnd,
  onSlotDragOver,
  onRowDragStart,
  onRowDragEnd,
  onRowDragOver,
  onRowDrop,
  onParticleStack,
  canInherit,
  rawDocument,
  parentDocument,
  sectionStructureInherited,
}: {
  sectionId: string
  row: LayoutRow
  modules: ModuleOption[]
  groups: UserGroupOption[]
  navMenus: NavMenuOption[]
  formDefinitions: FormDefinitionOption[]
  formsModuleEnabled: boolean
  primaryNavMenuId: string
  localSlots: LayoutSlot[]
  setLocalSlots: (slots: LayoutSlot[]) => void
  isDraggingRow: boolean
  rowDropEdge: 'before' | 'after' | null
  /** Section-level: which particle is being dragged (any row). */
  draggingSlotId: string | null
  /** Section-level insert hint for a particle in this row (beside). */
  slotDropHint: { slotId: string; edge: 'before' | 'after' } | null
  onSlotDragStart: (payload: SlotDragPayload) => void
  onSlotDragEnd: () => void
  onSlotDragOver: (
    slotId: string,
    edge: 'before' | 'after',
    placeBeside: boolean,
  ) => void
  onRowDragStart: (payload: RowDragPayload) => void
  onRowDragEnd: () => void
  onRowDragOver: (rowId: string, edge: 'before' | 'after') => void
  onRowDrop: (targetRowId: string, edge: 'before' | 'after', payload: RowDragPayload) => void
  /** Section-level stack (above/below) — optimistic when possible. */
  onParticleStack: (
    payload: SlotDragPayload,
    position: 'before' | 'after',
  ) => void
  canInherit: boolean
  rawDocument?: LayoutDocument
  parentDocument?: LayoutDocument | null
  sectionStructureInherited: boolean
}) {
  const router = useRouter()
  const layoutId = useLayoutOutlineId()
  const [pending, startTransition] = useTransition()
  const [dropActive, setDropActive] = useState(false)
  const [flash, setFlash] = useState<LayoutActionState>({})
  const [acceptingForeignSlot, setAcceptingForeignSlot] = useState(false)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const slots = sortSlots(localSlots)
  const isEmptyRow = slots.length === 0

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    // Give the canvas a beat after the local move before RSC refresh.
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null
      router.refresh()
    }, 500)
  }, [router])

  const persistRemoveEmptyRow = useCallback(() => {
    const fd = withOutlineId(new FormData(), layoutId)
    fd.set('sectionId', sectionId)
    fd.set('rowId', row.id)
    startTransition(async () => {
      const result = await removeLayoutRowAction({}, fd)
      setFlash(result)
      router.refresh()
    })
  }, [layoutId, row.id, router, sectionId])

  const persistDrop = useCallback(
    (moduleId: string, index?: number) => {
      const fd = withOutlineId(new FormData(), layoutId)
      fd.set('sectionId', sectionId)
      fd.set('rowId', row.id)
      fd.set('moduleId', moduleId)
      if (index != null) fd.set('index', String(index))
      startTransition(async () => {
        const result = await dropParticleIntoRowAction({}, fd)
        setFlash(result)
        router.refresh()
      })
    },
    [layoutId, row.id, router, sectionId],
  )

  const persistSlotOrder = useCallback(
    (ordered: LayoutSlot[]) => {
      const fd = withOutlineId(new FormData(), layoutId)
      fd.set('sectionId', sectionId)
      fd.set('rowId', row.id)
      fd.set('orderJson', JSON.stringify(ordered.map((s) => s.id)))
      startTransition(async () => {
        await reorderRowSlotsAction({}, fd)
        scheduleRefresh()
      })
    },
    [layoutId, row.id, scheduleRefresh, sectionId],
  )

  const persistMoveSlot = useCallback(
    (payload: SlotDragPayload, index?: number) => {
      const fd = withOutlineId(new FormData(), layoutId)
      fd.set('sourceSectionId', payload.sectionId)
      fd.set('sourceRowId', payload.rowId)
      fd.set('slotId', payload.slotId)
      fd.set('targetSectionId', sectionId)
      fd.set('targetRowId', row.id)
      if (index != null) fd.set('index', String(index))
      startTransition(async () => {
        const result = await moveSlotToRowAction({}, fd)
        if (result.error) setFlash(result)
        scheduleRefresh()
      })
    },
    [layoutId, row.id, scheduleRefresh, sectionId],
  )

  const clearLocalDropUi = useCallback(() => {
    setAcceptingForeignSlot(false)
    setDropActive(false)
  }, [])

  const finishSlotDrag = useCallback(() => {
    clearLocalDropUi()
    onSlotDragEnd()
  }, [clearLocalDropUi, onSlotDragEnd])

  const handleSlotDrop = useCallback(
    (targetSlotId: string, payload: SlotDragPayload) => {
      // Trust the blue-line hint from dragover (not drop-event coords).
      const stackEdge = rowDropEdge
      if (stackEdge) {
        finishSlotDrag()
        onParticleStack(payload, stackEdge)
        return
      }

      const edge =
        slotDropHint?.slotId === targetSlotId ? slotDropHint.edge : 'after'
      const sorted = sortSlots(localSlots)
      const targetIndex = sorted.findIndex((s) => s.id === targetSlotId)
      if (targetIndex < 0) {
        finishSlotDrag()
        return
      }
      const destIndex = edge === 'before' ? targetIndex : targetIndex + 1
      const sameRow = payload.sectionId === sectionId && payload.rowId === row.id

      if (sameRow) {
        const fromIndex = sorted.findIndex((s) => s.id === payload.slotId)
        // No-op when dropping onto own edges that keep the same position.
        if (
          fromIndex < 0 ||
          destIndex === fromIndex ||
          destIndex === fromIndex + 1
        ) {
          finishSlotDrag()
          return
        }
        const next = moveSlotInOrder(localSlots, payload.slotId, destIndex)
        setLocalSlots(next)
        finishSlotDrag()
        persistSlotOrder(next)
        return
      }

      // Other row / section: move this particle beside the target (left/right blue line).
      finishSlotDrag()
      persistMoveSlot(payload, destIndex)
    },
    [
      finishSlotDrag,
      localSlots,
      onParticleStack,
      persistMoveSlot,
      persistSlotOrder,
      row.id,
      rowDropEdge,
      sectionId,
      setLocalSlots,
      slotDropHint,
    ],
  )

  const commitResize = useCallback(
    (leftId: string, leftWidth: number, rightId: string, rightWidth: number) => {
      const fd = withOutlineId(new FormData(), layoutId)
      fd.set('sectionId', sectionId)
      fd.set('rowId', row.id)
      fd.set('leftSlotId', leftId)
      fd.set('rightSlotId', rightId)
      fd.set('leftWidth', String(leftWidth))
      startTransition(async () => {
        const result = await resizeAdjacentSlotsAction({}, fd)
        setFlash(result)
        // Keep local in sync even before refresh
        setLocalSlots(
          localSlots.map((s) => {
            if (s.id === leftId) return { ...s, width: leftWidth }
            if (s.id === rightId) return { ...s, width: rightWidth }
            return s
          }),
        )
        router.refresh()
        void rightWidth
      })
    },
    [layoutId, localSlots, row.id, router, sectionId, setLocalSlots],
  )

  const rowClassNames = [
    'gantry-row',
    dropActive || acceptingForeignSlot ? 'is-drop-target' : '',
    isDraggingRow ? 'is-row-dragging' : '',
    draggingSlotId ? 'is-slot-dnd-active' : '',
    // Top/bottom line: empty-row reorder OR particle stack (between bars).
    rowDropEdge === 'before' ? 'is-row-drop-before' : '',
    rowDropEdge === 'after' ? 'is-row-drop-after' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={rowClassNames}
      data-sf-row={row.id}
      onDragOver={(event) => {
        // Pure row drag (empty-row handle) — never while a particle is mid-drag.
        if (
          !draggingSlotId &&
          dataTransferHasType(event.dataTransfer, DND_ROW) &&
          !dataTransferHasType(event.dataTransfer, DND_SLOT)
        ) {
          event.preventDefault()
          event.stopPropagation()
          event.dataTransfer.dropEffect = 'move'
          const rect = event.currentTarget.getBoundingClientRect()
          const mid = rect.top + rect.height / 2
          onRowDragOver(row.id, event.clientY < mid ? 'before' : 'after')
          return
        }
        if (dataTransferHasType(event.dataTransfer, DND_PARTICLE)) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          setDropActive(true)
          return
        }
        if (dataTransferHasType(event.dataTransfer, DND_SLOT)) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          setAcceptingForeignSlot(true)
          setDropActive(true)
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        clearLocalDropUi()
      }}
      onDrop={(event) => {
        event.preventDefault()
        const slotPayload = parseSlotDragPayload(event.dataTransfer.getData(DND_SLOT))
        // Particle onto row chrome — honor stack hint, else merge into this row.
        if (slotPayload) {
          const sameRow =
            slotPayload.sectionId === sectionId && slotPayload.rowId === row.id
          const stackEdge = rowDropEdge
          finishSlotDrag()
          if (stackEdge) {
            onParticleStack(slotPayload, stackEdge)
            return
          }
          if (sameRow) return
          persistMoveSlot(slotPayload)
          return
        }
        const rowPayload = parseRowDragPayload(event.dataTransfer.getData(DND_ROW))
        if (rowPayload && rowPayload.sectionId === sectionId) {
          event.stopPropagation()
          const rect = event.currentTarget.getBoundingClientRect()
          const mid = rect.top + rect.height / 2
          onRowDrop(row.id, event.clientY < mid ? 'before' : 'after', rowPayload)
          return
        }
        // Palette particle into row.
        const moduleId = event.dataTransfer.getData(DND_PARTICLE)
        clearLocalDropUi()
        if (!moduleId) return
        persistDrop(moduleId)
      }}
    >
      {isEmptyRow ? (
        <div className="gantry-row-meta sf-layout-empty-row-meta">
          <span className="gantry-row-meta-label">
            Empty row · drop particles here · drag empty zone to reorder
          </span>
          <div className="gantry-row-actions">
            <button
              type="button"
              className="gantry-toolbar-btn secondary"
              title="Close empty drop row"
              disabled={pending}
              onClick={persistRemoveEmptyRow}
            >
              − row
            </button>
          </div>
        </div>
      ) : null}

      <div className="gantry-row-slots">
        {slots.length === 0 ? (
          <div
            className="gantry-row-empty"
            draggable
            title="Drag empty row to reorder"
            onDragStart={(event) => {
              event.stopPropagation()
              const payload: RowDragPayload = { sectionId, rowId: row.id }
              event.dataTransfer.setData(DND_ROW, encodeRowDragPayload(payload))
              event.dataTransfer.setData('text/plain', row.id)
              event.dataTransfer.effectAllowed = 'move'
              setHalfOpacityDragImage(event)
              onRowDragStart(payload)
            }}
            onDragEnd={(event) => {
              event.stopPropagation()
              onRowDragEnd()
            }}
          >
            Drop particles here… · drag to reorder row
          </div>
        ) : (
          slots.map((slot, index) => {
            const percent = gridWidthPercent(slot.width)
            const next = slots[index + 1]
            return (
              <React.Fragment key={slot.id}>
                <ParticleBlock
                  sectionId={sectionId}
                  rowId={row.id}
                  slot={slot}
                  modules={modules}
                  groups={groups}
                  navMenus={navMenus}
                  formDefinitions={formDefinitions}
                  formsModuleEnabled={formsModuleEnabled}
                  primaryNavMenuId={primaryNavMenuId}
                  percent={percent}
                  isDragging={draggingSlotId === slot.id}
                  dropEdge={
                    slotDropHint?.slotId === slot.id && draggingSlotId !== slot.id
                      ? slotDropHint.edge
                      : null
                  }
                  onSlotDragStart={(payload) => {
                    setAcceptingForeignSlot(false)
                    onSlotDragStart(payload)
                  }}
                  onSlotDragEnd={finishSlotDrag}
                  onSlotDragOver={(id, edge, placeBeside) => {
                    if (draggingSlotId === id) return
                    setAcceptingForeignSlot(placeBeside)
                    onSlotDragOver(id, edge, placeBeside)
                  }}
                  onSlotDrop={(id, payload) => handleSlotDrop(id, payload)}
                  onSlotPatched={(patch) => {
                    setLocalSlots(
                      localSlots.map((s) => {
                        if (s.id !== slot.id) return s
                        const next: LayoutSlot = { ...s, ...patch }
                        if ('htmlId' in patch && !patch.htmlId) delete next.htmlId
                        if ('cssClass' in patch && !patch.cssClass) delete next.cssClass
                        return next
                      }),
                    )
                  }}
                  canInherit={canInherit}
                  particleInherited={rawSlotInherited(
                    rawDocument,
                    sectionId,
                    row.id,
                    slot.id,
                  )}
                  parentHasMatchingSlot={parentHasSlot(
                    parentDocument,
                    sectionId,
                    slot.id,
                  )}
                  sectionStructureInherited={sectionStructureInherited}
                />
                {next ? (
                  <ResizeHandle
                    sectionId={sectionId}
                    rowId={row.id}
                    left={slot}
                    right={next}
                    onLocalResize={(leftId, lw, rightId, rw) => {
                      setLocalSlots(
                        localSlots.map((s) => {
                          if (s.id === leftId) return { ...s, width: lw }
                          if (s.id === rightId) return { ...s, width: rw }
                          return s
                        }),
                      )
                    }}
                    onCommit={commitResize}
                  />
                ) : null}
              </React.Fragment>
            )
          })
        )}
      </div>
      <ActionFeedback state={flash} />
    </div>
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
  isDraggingSection,
  dropPosition,
  placeBesideHint,
  onSectionDragStart,
  onSectionDragEnd,
  onSectionDragOver,
  onSectionDrop,
  onSectionRemoved,
  canInherit,
  rawDocument,
  parentDocument,
  parentLayoutId,
}: {
  section: LayoutSection
  modules: ModuleOption[]
  groups: UserGroupOption[]
  navMenus: NavMenuOption[]
  formDefinitions: FormDefinitionOption[]
  formsModuleEnabled: boolean
  primaryNavMenuId: string
  canRemoveSection: boolean
  isDraggingSection: boolean
  dropPosition: 'before' | 'after' | null
  placeBesideHint: boolean
  onSectionDragStart: (sectionId: string) => void
  onSectionDragEnd: () => void
  onSectionDragOver: (
    sectionId: string,
    position: 'before' | 'after',
    placeBeside: boolean,
  ) => void
  onSectionDrop: (
    targetSectionId: string,
    position: 'before' | 'after',
    placeBeside: boolean,
  ) => void
  onSectionRemoved: (sectionId: string) => void
  canInherit: boolean
  rawDocument?: LayoutDocument
  parentDocument?: LayoutDocument | null
  parentLayoutId?: string | null
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
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null)
  const [rowDropHint, setRowDropHint] = useState<{
    rowId: string
    edge: 'before' | 'after'
  } | null>(null)
  /** Particle drag UI lives at section level so left/right lines work across rows. */
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null)
  const [slotDropHint, setSlotDropHint] = useState<{
    rowId: string
    slotId: string
    edge: 'before' | 'after'
  } | null>(null)

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

  const clearRowDragUi = useCallback(() => {
    setDraggingRowId(null)
    setRowDropHint(null)
  }, [])

  const clearSlotDragUi = useCallback(() => {
    setDraggingSlotId(null)
    setSlotDropHint(null)
    setRowDropHint(null)
  }, [])

  const handleRowDrop = useCallback(
    (targetRowId: string, edge: 'before' | 'after', payload: RowDragPayload) => {
      if (payload.sectionId !== section.id) {
        clearRowDragUi()
        return
      }
      const sorted = sortRows(localRows)
      const targetIndex = sorted.findIndex((r) => r.id === targetRowId)
      const fromIndex = sorted.findIndex((r) => r.id === payload.rowId)
      if (targetIndex < 0 || fromIndex < 0) {
        clearRowDragUi()
        return
      }
      const destIndex = edge === 'before' ? targetIndex : targetIndex + 1
      if (destIndex === fromIndex || destIndex === fromIndex + 1) {
        clearRowDragUi()
        return
      }
      const next = moveRowInOrder(sorted, payload.rowId, destIndex)
      setLocalRows(next)
      clearRowDragUi()
      persistRowOrder(next)
    },
    [clearRowDragUi, localRows, persistRowOrder, section.id],
  )

  /**
   * Particle stack (horizontal blue line): prefer instant local row reorder when
   * the dragged particle is alone in its row; otherwise persist via server action.
   */
  const handleParticleStack = useCallback(
    (payload: SlotDragPayload, targetRowId: string, position: 'before' | 'after') => {
      clearSlotDragUi()
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
        const next = moveRowInOrder(sorted, payload.rowId, destIndex)
        setLocalRows(next)
        persistRowOrder(next)
        return
      }

      const fd = withOutlineId(new FormData(), layoutId)
      fd.set('sourceSectionId', payload.sectionId)
      fd.set('sourceRowId', payload.rowId)
      fd.set('slotId', payload.slotId)
      fd.set('targetSectionId', section.id)
      fd.set('targetRowId', targetRowId)
      fd.set('position', position)
      startRowTransition(async () => {
        const result = await stackSlotAsRowAction({}, fd)
        if (result.error) notifyError(result.error)
        scheduleRowRefresh()
      })
    },
    [
      clearSlotDragUi,
      layoutId,
      localRows,
      notifyError,
      persistRowOrder,
      scheduleRowRefresh,
      section.id,
      slotMap,
    ],
  )

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

  const classNames = [
    'gantry-section',
    isDraggingSection ? 'is-section-dragging' : '',
    dropPosition === 'before' ? 'is-section-drop-before' : '',
    dropPosition === 'after' ? 'is-section-drop-after' : '',
    placeBesideHint ? 'is-section-drop-inline' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const sectionWidth = clampGridWidth(section.width ?? LAYOUT_WIDTH_FULL, LAYOUT_WIDTH_FULL)

  return (
    <li
      className={classNames}
      data-sf-section={section.id}
      data-sf-width={sectionWidth}
      style={gridColStyle(sectionWidth)}
      onDragOver={(event) => {
        if (![...event.dataTransfer.types].includes(DND_SECTION)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
        const edge = mosaicSectionDropEdge(
          event.clientX,
          event.clientY,
          event.currentTarget.getBoundingClientRect(),
        )
        onSectionDragOver(section.id, edge.position, edge.placeBeside)
      }}
      onDrop={(event) => {
        if (![...event.dataTransfer.types].includes(DND_SECTION)) return
        event.preventDefault()
        event.stopPropagation()
        const edge = mosaicSectionDropEdge(
          event.clientX,
          event.clientY,
          event.currentTarget.getBoundingClientRect(),
        )
        onSectionDrop(section.id, edge.position, edge.placeBeside)
      }}
    >
      <header className="gantry-section-head">
        <div className="gantry-section-title">
          <button
            type="button"
            className="gantry-section-handle"
            draggable
            title="Drag: drop above/below to reorder, left/right to place beside"
            aria-label={`Drag to move section ${section.label}`}
            onDragStart={(event) => {
              event.stopPropagation()
              event.dataTransfer.setData(DND_SECTION, section.id)
              event.dataTransfer.setData('text/plain', section.id)
              event.dataTransfer.effectAllowed = 'move'
              onSectionDragStart(section.id)
            }}
            onDragEnd={onSectionDragEnd}
          >
            ⋮⋮
          </button>
          <div className="gantry-section-identity">
            {structureInherited ? (
              <span className="gantry-inherit-badge" title="Structure inherited from parent outline">
                Inherited
              </span>
            ) : null}
            <label className="gantry-inline-label gantry-section-name-label">
              <span className="sr-only">Section name</span>
              <input
                key={`section-label-${section.id}-${section.label}`}
                type="text"
                className="gantry-inline-input gantry-section-name-input"
                defaultValue={section.label}
                disabled={metaPending}
                required
                title="Section display name"
                aria-label="Section name"
                onBlur={(event) => {
                  const next = event.target.value.trim()
                  if (!next) {
                    event.target.value = section.label
                    return
                  }
                  persistSectionMeta({ label: next })
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    ;(event.target as HTMLInputElement).blur()
                  }
                }}
              />
            </label>
            <label
              className="gantry-inline-label gantry-section-width-label"
              title="Section mosaic width — two ~50% sections sit side by side"
            >
              <span className="sr-only">Section width percent</span>
              <input
                key={`section-width-${section.id}-${sectionWidth}`}
                type="number"
                className="gantry-inline-input gantry-section-width-input"
                defaultValue={sectionWidth}
                min={LAYOUT_WIDTH_MIN}
                max={LAYOUT_WIDTH_FULL}
                step={5}
                disabled={metaPending}
                aria-label="Section width percent"
                onBlur={(event) => {
                  persistSectionMeta({ width: Number(event.target.value) })
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    ;(event.target as HTMLInputElement).blur()
                  }
                }}
                onClick={(event) => event.stopPropagation()}
              />
              <span className="gantry-slot-pct" aria-hidden="true">
                %
              </span>
            </label>
          </div>
        </div>
        <div className="gantry-section-head-actions">
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
              {canInherit ? (
                <div className="gantry-section-inherit-block">
                  <span className="gantry-field-hint">Inheritance</span>
                  {parentHasSection ? (
                    <InheritCopyRow
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
                      hint={
                        parentLayoutId
                          ? `Parent outline: ${parentLayoutId}. Inherit shows parent particles live; Copy snapshots them here.`
                          : undefined
                      }
                    />
                  ) : (
                    <p className="settings-hint">
                      Parent outline has no section with id <code>{section.id}</code>.
                    </p>
                  )}
                </div>
              ) : null}
              <label className="gantry-inline-label gantry-section-container-label">
                <span className="gantry-field-hint">Container</span>
                <select
                  key={`section-container-${section.id}-${section.containerMode ?? 'full'}`}
                  className="gantry-inline-input gantry-section-container-select"
                  defaultValue={section.containerMode ?? 'full'}
                  disabled={metaPending || structureInherited}
                  title="Section owns container width — row % is share inside"
                  aria-label="Section container width"
                  onChange={(event) => {
                    const next = event.target.value === 'boxed' ? 'boxed' : 'full'
                    persistSectionMeta({ containerMode: next })
                  }}
                >
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
        </div>
      </header>
      <ActionFeedback state={metaFlash} />

      {rows.length === 0 ? (
        <p className="layout-muted">Open + row to drop particles, or drag onto a new empty row.</p>
      ) : (
        rows.map((row) => (
          <DropRow
            key={row.id}
            sectionId={section.id}
            row={row}
            modules={modules}
            groups={groups}
            navMenus={navMenus}
            formDefinitions={formDefinitions}
            formsModuleEnabled={formsModuleEnabled}
            primaryNavMenuId={primaryNavMenuId}
            localSlots={slotMap[row.id] ?? sortSlots(row.slots)}
            setLocalSlots={(slots) => setSlotMap((prev) => ({ ...prev, [row.id]: slots }))}
            isDraggingRow={draggingRowId === row.id}
            rowDropEdge={
              rowDropHint?.rowId === row.id && draggingRowId !== row.id
                ? rowDropHint.edge
                : null
            }
            draggingSlotId={draggingSlotId}
            slotDropHint={
              slotDropHint?.rowId === row.id
                ? { slotId: slotDropHint.slotId, edge: slotDropHint.edge }
                : null
            }
            onSlotDragStart={(payload) => {
              setDraggingSlotId(payload.slotId)
              setSlotDropHint(null)
              setRowDropHint(null)
              setDraggingRowId(null)
            }}
            onSlotDragEnd={clearSlotDragUi}
            onSlotDragOver={(slotId, edge, placeBeside) => {
              if (placeBeside) {
                setRowDropHint(null)
                setSlotDropHint({ rowId: row.id, slotId, edge })
                return
              }
              // Vertical intent → horizontal blue line above/below this row.
              setSlotDropHint(null)
              setRowDropHint({ rowId: row.id, edge })
            }}
            onRowDragStart={(payload) => {
              setDraggingRowId(payload.rowId)
              setRowDropHint(null)
              setDraggingSlotId(null)
              setSlotDropHint(null)
            }}
            onRowDragEnd={clearRowDragUi}
            onRowDragOver={(id, edge) => {
              if (draggingRowId === id) return
              setSlotDropHint(null)
              setRowDropHint({ rowId: id, edge })
            }}
            onRowDrop={handleRowDrop}
            onParticleStack={(payload, position) =>
              handleParticleStack(payload, row.id, position)
            }
            canInherit={canInherit}
            rawDocument={rawDocument}
            parentDocument={parentDocument}
            sectionStructureInherited={structureInherited}
          />
        ))
      )}
      {(() => {
        if (structureInherited) {
          return (
            <p className="settings-hint gantry-section-inherit-hint">
              Structure inherited from parent — particles are read-only here. Turn inherit off or
              Copy from parent in section settings to edit.
            </p>
          )
        }
        const last = rows[rows.length - 1]
        const trailingEmpty = Boolean(last && layoutRowIsEmpty(last))
        if (trailingEmpty) return null
        return (
          <div className="sf-form-row-end-actions gantry-row-end-actions">
            <button
              type="button"
              className="gantry-toolbar-btn secondary"
              title="Open an empty drop row at the end"
              disabled={rowPending}
              onClick={persistAddEmptyRow}
            >
              + row
            </button>
          </div>
        )
      })()}
    </li>
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
  parentLayoutId = null,
  source,
  modules,
  groups,
  navMenus = [],
  formDefinitions = [],
  formsModuleEnabled = true,
  primaryNavMenuId = 'main',
  layoutId,
  layoutLabel,
}: Props) {
  const router = useRouter()
  const outlineId = layoutId
  const canInherit = Boolean(
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
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null)
  const draggingSectionIdRef = useRef<string | null>(null)
  const [dropHint, setDropHint] = useState<{
    sectionId: string
    position: 'before' | 'after'
    placeBeside: boolean
  } | null>(null)

  const [sectionList, setSectionList] = useState(() => sortSections(document.sections))
  const [sectionListSource, setSectionListSource] = useState(document.sections)

  // Soft-merge when the server layout document refreshes (particle autosave revalidate).
  if (document.sections !== sectionListSource) {
    setSectionListSource(document.sections)
    setSectionList((prev) => mergeSectionsFromServer(prev, document.sections))
  }

  const clearSectionDrag = useCallback(() => {
    draggingSectionIdRef.current = null
    setDraggingSectionId(null)
    setDropHint(null)
  }, [])

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
    (targetSectionId: string, position: 'before' | 'after', placeBeside: boolean) => {
      const movingId = draggingSectionIdRef.current ?? draggingSectionId
      if (!movingId || movingId === targetSectionId) {
        clearSectionDrag()
        return
      }
      const without = sectionList.filter((s) => s.id !== movingId)
      const moving = sectionList.find((s) => s.id === movingId)
      if (!moving) {
        clearSectionDrag()
        return
      }
      const targetIndex = without.findIndex((s) => s.id === targetSectionId)
      if (targetIndex < 0) {
        clearSectionDrag()
        return
      }
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
      clearSectionDrag()
      persistSectionOrder(next, widthOverrides)
    },
    [clearSectionDrag, draggingSectionId, persistSectionOrder, sectionList],
  )

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
                    event.dataTransfer.setData(DND_PARTICLE, mod.id)
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
                  isDraggingSection={draggingSectionId === section.id}
                  dropPosition={
                    dropHint?.sectionId === section.id && draggingSectionId !== section.id
                      ? dropHint.position
                      : null
                  }
                  placeBesideHint={Boolean(
                    dropHint?.sectionId === section.id &&
                      draggingSectionId !== section.id &&
                      dropHint?.placeBeside,
                  )}
                  onSectionDragStart={(id) => {
                    draggingSectionIdRef.current = id
                    setDraggingSectionId(id)
                    setDropHint(null)
                  }}
                  onSectionDragEnd={() => {
                    clearSectionDrag()
                  }}
                  onSectionDragOver={(id, position, placeBeside) => {
                    const movingId = draggingSectionIdRef.current ?? draggingSectionId
                    if (!movingId || movingId === id) return
                    setDropHint({ sectionId: id, position, placeBeside })
                  }}
                  onSectionDrop={handleSectionDrop}
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
                  parentLayoutId={parentLayoutId}
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

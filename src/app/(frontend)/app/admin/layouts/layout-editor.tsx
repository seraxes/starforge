'use client'

import React, { useActionState, useCallback, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { AccessTagsField } from '@/components/admin/AccessTagsField'
import { GantryBarRemoveButton } from '@/components/admin/GantryBarRemoveButton'
import { resolveAccessTags } from '@/core/acl/nav-access'
import type { UserGroupOption } from '@/core/acl/types'
import {
  addLayoutRowAction,
  addLayoutSectionAction,
  dropParticleIntoRowAction,
  moveSlotToRowAction,
  removeLayoutRowAction,
  removeSlotAction,
  renameLayoutSlotAction,
  reorderLayoutSectionsAction,
  reorderRowSlotsAction,
  resetLayoutToDefaultAction,
  resizeAdjacentSlotsAction,
  setSlotAccessTagsAction,
  toggleSlotAction,
  updateLayoutSectionMetaAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import { LayoutIdField, useLayoutOutlineId } from './layout-outline-context'
import {
  gridWidthPercent,
  LAYOUT_WIDTH_FULL,
  LAYOUT_WIDTH_MIN,
  resizeAdjacentPair,
  sumRowWidths,
  widthToPercentLabel,
} from '@/core/modules/grid'
import { sortLayoutSectionsByOrder } from '@/core/modules/section-order'
import { cssColorToColorInputValue } from '@/core/modules/styles'
import type { LayoutDocument, LayoutRow, LayoutSection, LayoutSlot } from '@/core/modules/types'

import { useAdminToast } from '../admin-toast'
import { CustomParticleEditor } from './custom-particle-editor'
import { ParticleAttributesEditor } from './particle-attributes-editor'
import { ParticleSettingsPopover } from './particle-settings-popover'
import {
  TypedParticleEditor,
  type FormDefinitionOption,
  type NavMenuOption,
} from './typed-particle-editors'

type ModuleOption = {
  id: string
  name: string
  description: string
  builtin: boolean
  defaultWidth: number
}

type Props = {
  document: LayoutDocument
  source: 'database' | 'default-json'
  modules: ModuleOption[]
  /** Users → Groups options for slot accessTags multi-select. */
  groups: UserGroupOption[]
  /** Nav manager menu sets for Menu particle picker. */
  navMenus?: NavMenuOption[]
  /** Form definitions for Form particle picker. */
  formDefinitions?: FormDefinitionOption[]
  primaryNavMenuId?: string
  layoutId: string
  layoutLabel: string
}

const initialState: LayoutActionState = {}

const DND_PARTICLE = 'application/x-starforge-particle'
const DND_SECTION = 'application/x-starforge-section'
/** Existing placed particle — JSON `{ sectionId, rowId, slotId }` (any section → any row). */
const DND_SLOT = 'application/x-starforge-slot'

type SlotDragPayload = {
  sectionId: string
  rowId: string
  slotId: string
}

function encodeSlotDragPayload(payload: SlotDragPayload): string {
  return JSON.stringify(payload)
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
  primaryNavMenuId,
  onSlotPatched,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  navMenus: NavMenuOption[]
  formDefinitions: FormDefinitionOption[]
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

  if (slot.moduleId === 'custom') {
    return (
      <div className="gantry-particle-config-stack">
        {attrs}
        <CustomParticleEditor
          sectionId={sectionId}
          rowId={rowId}
          slot={slot}
          embedded
          onConfigSaved={(config) => onSlotPatched?.({ config })}
        />
      </div>
    )
  }

  const hasTyped =
    slot.moduleId === 'logo' ||
    slot.moduleId === 'menu' ||
    slot.moduleId === 'copyright' ||
    slot.moduleId === 'social' ||
    slot.moduleId === 'form'

  return (
    <div className="gantry-particle-config-stack">
      {attrs}
      {hasTyped ? (
        <TypedParticleEditor
          sectionId={sectionId}
          rowId={rowId}
          slot={slot}
          navMenus={navMenus}
          formDefinitions={formDefinitions}
          primaryNavMenuId={primaryNavMenuId}
          embedded
          onConfigSaved={(config) => onSlotPatched?.({ config })}
        />
      ) : (
        <p className="layout-muted">
          No particle-specific config for <code>{slot.moduleId}</code>.
        </p>
      )}
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
  primaryNavMenuId,
  percent,
  isDragging,
  dropEdge,
  onSlotDragStart,
  onSlotDragEnd,
  onSlotDragOver,
  onSlotDrop,
  onSlotPatched,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  modules: ModuleOption[]
  groups: UserGroupOption[]
  navMenus: NavMenuOption[]
  formDefinitions: FormDefinitionOption[]
  primaryNavMenuId: string
  percent: number
  isDragging: boolean
  dropEdge: 'before' | 'after' | null
  onSlotDragStart: (payload: SlotDragPayload) => void
  onSlotDragEnd: () => void
  onSlotDragOver: (slotId: string, edge: 'before' | 'after') => void
  onSlotDrop: (
    targetSlotId: string,
    edge: 'before' | 'after',
    payload: SlotDragPayload,
  ) => void
  onSlotPatched?: (patch: Partial<LayoutSlot>) => void
}) {
  const router = useRouter()
  const layoutId = useLayoutOutlineId()
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
      style={{
        /* Grow by % share so resize handles don't force wrap/overflow. */
        flex: `${percent} 1 0`,
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
      onDragOver={(event) => {
        if (!dataTransferHasType(event.dataTransfer, DND_SLOT)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
        const rect = event.currentTarget.getBoundingClientRect()
        const mid = rect.left + rect.width / 2
        onSlotDragOver(slot.id, event.clientX < mid ? 'before' : 'after')
      }}
      onDrop={(event) => {
        if (!dataTransferHasType(event.dataTransfer, DND_SLOT)) return
        event.preventDefault()
        event.stopPropagation()
        const payload = parseSlotDragPayload(event.dataTransfer.getData(DND_SLOT))
        if (!payload) return
        const rect = event.currentTarget.getBoundingClientRect()
        const mid = rect.left + rect.width / 2
        onSlotDrop(slot.id, event.clientX < mid ? 'before' : 'after', payload)
      }}
    >
      <header className="gantry-slot-head">
        <div className="gantry-slot-title">
          <button
            type="button"
            className="gantry-slot-handle"
            draggable
            title="Drag to reorder in this row or move to another section"
            aria-label={`Drag to move ${displayName}`}
            onDragStart={(event) => {
              event.stopPropagation()
              const payload: SlotDragPayload = {
                sectionId,
                rowId,
                slotId: slot.id,
              }
              event.dataTransfer.setData(DND_SLOT, encodeSlotDragPayload(payload))
              event.dataTransfer.setData('text/plain', slot.id)
              event.dataTransfer.effectAllowed = 'move'
              onSlotDragStart(payload)
            }}
            onDragEnd={(event) => {
              event.stopPropagation()
              onSlotDragEnd()
            }}
          >
            ▣
          </button>
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
                title="Instance display name (does not change particle type)"
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
            </span>
          </div>
        </div>
        <div className="gantry-slot-end">
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
                      disabled={pending}
                      onChange={persistAccessTags}
                    />
                  ),
                },
                {
                  id: 'particle',
                  label: 'Particle',
                  content: (
                    <div className="gantry-slot-extra-actions">
                      <button
                        type="button"
                        className="secondary"
                        disabled={pending}
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
  primaryNavMenuId,
  localSlots,
  setLocalSlots,
}: {
  sectionId: string
  row: LayoutRow
  modules: ModuleOption[]
  groups: UserGroupOption[]
  navMenus: NavMenuOption[]
  formDefinitions: FormDefinitionOption[]
  primaryNavMenuId: string
  localSlots: LayoutSlot[]
  setLocalSlots: (slots: LayoutSlot[]) => void
}) {
  const router = useRouter()
  const layoutId = useLayoutOutlineId()
  const [pending, startTransition] = useTransition()
  const [dropActive, setDropActive] = useState(false)
  const [flash, setFlash] = useState<LayoutActionState>({})
  const [removeRowState, removeRowAction, removeRowPending] = useActionState(
    removeLayoutRowAction,
    initialState,
  )

  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null)
  const [acceptingForeignSlot, setAcceptingForeignSlot] = useState(false)
  const [slotDropHint, setSlotDropHint] = useState<{
    slotId: string
    edge: 'before' | 'after'
  } | null>(null)

  const slots = sortSlots(localSlots)
  const widthSum = sumRowWidths(slots.map((s) => s.width))

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
        const result = await reorderRowSlotsAction({}, fd)
        setFlash(result)
        router.refresh()
      })
    },
    [layoutId, row.id, router, sectionId],
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
        setFlash(result)
        router.refresh()
      })
    },
    [layoutId, row.id, router, sectionId],
  )

  const clearSlotDragUi = useCallback(() => {
    setDraggingSlotId(null)
    setAcceptingForeignSlot(false)
    setSlotDropHint(null)
    setDropActive(false)
  }, [])

  const handleSlotDrop = useCallback(
    (targetSlotId: string, edge: 'before' | 'after', payload: SlotDragPayload) => {
      const sorted = sortSlots(localSlots)
      const targetIndex = sorted.findIndex((s) => s.id === targetSlotId)
      if (targetIndex < 0) {
        clearSlotDragUi()
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
          clearSlotDragUi()
          return
        }
        const next = moveSlotInOrder(localSlots, payload.slotId, destIndex)
        setLocalSlots(next)
        clearSlotDragUi()
        persistSlotOrder(next)
        return
      }

      clearSlotDragUi()
      persistMoveSlot(payload, destIndex)
    },
    [
      clearSlotDragUi,
      localSlots,
      persistMoveSlot,
      persistSlotOrder,
      row.id,
      sectionId,
      setLocalSlots,
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

  return (
    <div
      className={
        dropActive || acceptingForeignSlot ? 'gantry-row is-drop-target' : 'gantry-row'
      }
      data-sf-row={row.id}
      onDragOver={(event) => {
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
        setDropActive(false)
        setAcceptingForeignSlot(false)
        setSlotDropHint(null)
      }}
      onDrop={(event) => {
        event.preventDefault()
        // Existing placed particle → this row (any section).
        const slotPayload = parseSlotDragPayload(event.dataTransfer.getData(DND_SLOT))
        if (slotPayload) {
          const sameRow =
            slotPayload.sectionId === sectionId && slotPayload.rowId === row.id
          clearSlotDragUi()
          if (sameRow) return
          persistMoveSlot(slotPayload)
          return
        }
        // Palette particle into row.
        const moduleId = event.dataTransfer.getData(DND_PARTICLE)
        clearSlotDragUi()
        if (!moduleId) return
        persistDrop(moduleId)
      }}
    >
      <div className="gantry-row-meta">
        <span>
          Row · drop particles here
          {slots.length > 0 ? <> · {widthSum}% total</> : null}
          {widthSum > LAYOUT_WIDTH_FULL ? (
            <span className="admin-badge admin-badge-warn"> overflows 100%</span>
          ) : null}
          {slots.length > 0 ? (
            <span className="layout-muted">
              {' '}
              · drag ⋮⋮ to reorder or move across sections · resize 5%–95%
            </span>
          ) : null}
          {pending ? <span className="layout-muted"> · saving…</span> : null}
        </span>
        <div className="gantry-row-actions">
          <form action={removeRowAction}>
            <LayoutIdField />
            <input type="hidden" name="sectionId" value={sectionId} />
            <input type="hidden" name="rowId" value={row.id} />
            <button type="submit" className="danger" disabled={removeRowPending}>
              ✕ Remove row
            </button>
          </form>
        </div>
      </div>

      <div className="gantry-row-slots">
        {slots.length === 0 ? (
          <div className="gantry-row-empty">Drop particles here…</div>
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
                  primaryNavMenuId={primaryNavMenuId}
                  percent={percent}
                  isDragging={draggingSlotId === slot.id}
                  dropEdge={
                    slotDropHint?.slotId === slot.id && draggingSlotId !== slot.id
                      ? slotDropHint.edge
                      : null
                  }
                  onSlotDragStart={(payload) => {
                    setDraggingSlotId(payload.slotId)
                    setSlotDropHint(null)
                  }}
                  onSlotDragEnd={() => {
                    clearSlotDragUi()
                  }}
                  onSlotDragOver={(id, edge) => {
                    if (draggingSlotId === id) return
                    setSlotDropHint({ slotId: id, edge })
                    setAcceptingForeignSlot(true)
                  }}
                  onSlotDrop={handleSlotDrop}
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
      <ActionFeedback state={removeRowState} />
    </div>
  )
}

function SectionCanvas({
  section,
  modules,
  groups,
  navMenus,
  formDefinitions,
  primaryNavMenuId,
  isDraggingSection,
  dropPosition,
  onSectionDragStart,
  onSectionDragEnd,
  onSectionDragOver,
  onSectionDrop,
}: {
  section: LayoutSection
  modules: ModuleOption[]
  groups: UserGroupOption[]
  navMenus: NavMenuOption[]
  formDefinitions: FormDefinitionOption[]
  primaryNavMenuId: string
  isDraggingSection: boolean
  dropPosition: 'before' | 'after' | null
  onSectionDragStart: (sectionId: string) => void
  onSectionDragEnd: () => void
  onSectionDragOver: (sectionId: string, position: 'before' | 'after') => void
  onSectionDrop: (targetSectionId: string, position: 'before' | 'after') => void
}) {
  const router = useRouter()
  const layoutId = useLayoutOutlineId()
  const [metaPending, startMetaSave] = useTransition()
  const [metaFlash, setMetaFlash] = useState<LayoutActionState>({})
  const { notifySaved, notifyError } = useAdminToast()
  const [rowState, rowAction, rowPending] = useActionState(addLayoutRowAction, initialState)
  const rows = sortRows(section.rows)
  const [slotMap, setSlotMap] = useState<Record<string, LayoutSlot[]>>(() => {
    const map: Record<string, LayoutSlot[]> = {}
    for (const row of section.rows) map[row.id] = sortSlots(row.slots)
    return map
  })
  const [slotMapSource, setSlotMapSource] = useState(section)

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

  const persistSectionMeta = useCallback(
    (fields: {
      label?: string
      cssClass?: string
      containerMode?: 'full' | 'boxed'
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
      section.styles?.backgroundColor,
      section.styles?.textColor,
    ],
  )

  const classNames = [
    'gantry-section',
    isDraggingSection ? 'is-section-dragging' : '',
    dropPosition === 'before' ? 'is-section-drop-before' : '',
    dropPosition === 'after' ? 'is-section-drop-after' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li
      className={classNames}
      data-sf-section={section.id}
      onDragOver={(event) => {
        if (![...event.dataTransfer.types].includes(DND_SECTION)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        const rect = event.currentTarget.getBoundingClientRect()
        const mid = rect.top + rect.height / 2
        onSectionDragOver(section.id, event.clientY < mid ? 'before' : 'after')
      }}
      onDrop={(event) => {
        if (![...event.dataTransfer.types].includes(DND_SECTION)) return
        event.preventDefault()
        event.stopPropagation()
        const rect = event.currentTarget.getBoundingClientRect()
        const mid = rect.top + rect.height / 2
        onSectionDrop(section.id, event.clientY < mid ? 'before' : 'after')
      }}
    >
      <header className="gantry-section-head">
        <div className="gantry-section-title">
          <button
            type="button"
            className="gantry-section-handle"
            draggable
            title="Drag to reorder section"
            aria-label={`Drag to reorder section ${section.label}`}
            onDragStart={(event) => {
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
          </div>
        </div>
        <div className="gantry-section-head-actions">
          <form action={rowAction} className="gantry-section-actions">
            <LayoutIdField />
            <input type="hidden" name="sectionId" value={section.id} />
            <button
              type="submit"
              className="gantry-section-icon-btn"
              disabled={rowPending}
              title="Add row"
              aria-label="Add row"
            >
              {rowPending ? '…' : '+'}
            </button>
          </form>
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
                <span className="gantry-field-hint">Width</span>
                <select
                  key={`section-container-${section.id}-${section.containerMode ?? 'full'}`}
                  className="gantry-inline-input gantry-section-container-select"
                  defaultValue={section.containerMode ?? 'full'}
                  disabled={metaPending}
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
      <ActionFeedback state={rowState} />

      {rows.length === 0 ? (
        <p className="layout-muted">Add a row, then drag particles into it.</p>
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
            primaryNavMenuId={primaryNavMenuId}
            localSlots={slotMap[row.id] ?? sortSlots(row.slots)}
            setLocalSlots={(slots) => setSlotMap((prev) => ({ ...prev, [row.id]: slots }))}
          />
        ))
      )}
    </li>
  )
}

/**
 * Gantry Layout Manager–style canvas:
 * 1) Create section → 2) Add row → 3) Drag particle from left into row →
 * 4) Drop another beside it and resize by % → drag ⋮⋮ on particles to reorder in-row →
 * sections reorder via drag handle.
 */
export function LayoutEditor({
  document,
  source,
  modules,
  groups,
  navMenus = [],
  formDefinitions = [],
  primaryNavMenuId = 'main',
  layoutId,
  layoutLabel,
}: Props) {
  const router = useRouter()
  const outlineId = layoutId
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
  const [dropHint, setDropHint] = useState<{
    sectionId: string
    position: 'before' | 'after'
  } | null>(null)

  const [sectionList, setSectionList] = useState(() => sortSections(document.sections))
  const [sectionListSource, setSectionListSource] = useState(document.sections)

  // Soft-merge when the server layout document refreshes (particle autosave revalidate).
  if (document.sections !== sectionListSource) {
    setSectionListSource(document.sections)
    setSectionList((prev) => mergeSectionsFromServer(prev, document.sections))
  }

  const persistSectionOrder = useCallback(
    (ordered: LayoutSection[]) => {
      const fd = withOutlineId(new FormData(), outlineId)
      fd.set('orderJson', JSON.stringify(ordered.map((s) => s.id)))
      startSectionSave(async () => {
        const result = await reorderLayoutSectionsAction({}, fd)
        setReorderFlash(result)
        router.refresh()
      })
    },
    [outlineId, router],
  )

  const handleSectionDrop = useCallback(
    (targetSectionId: string, position: 'before' | 'after') => {
      if (!draggingSectionId || draggingSectionId === targetSectionId) {
        setDraggingSectionId(null)
        setDropHint(null)
        return
      }
      const without = sectionList.filter((s) => s.id !== draggingSectionId)
      const moving = sectionList.find((s) => s.id === draggingSectionId)
      if (!moving) {
        setDraggingSectionId(null)
        setDropHint(null)
        return
      }
      const targetIndex = without.findIndex((s) => s.id === targetSectionId)
      if (targetIndex < 0) {
        setDraggingSectionId(null)
        setDropHint(null)
        return
      }
      const insertAt = position === 'before' ? targetIndex : targetIndex + 1
      const next = [...without.slice(0, insertAt), moving, ...without.slice(insertAt)].map(
        (section, index) => ({ ...section, order: index }),
      )
      setSectionList(next)
      setDraggingSectionId(null)
      setDropHint(null)
      persistSectionOrder(next)
    },
    [draggingSectionId, persistSectionOrder, sectionList],
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
        : <strong>drag sections</strong> to reorder · section → row → drag particles · resize by %
        (1% steps, min 5%).
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
              <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-muted" disabled={sectionPending}>
                {sectionPending ? 'Adding…' : '+ Section'}
              </button>
            </form>
            <div className="gantry-canvas-toolbar-end">
              <div className="gantry-canvas-toolbar-primary">
                <Link
                  href="/app/admin/outlines"
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
                  primaryNavMenuId={primaryNavMenuId}
                  isDraggingSection={draggingSectionId === section.id}
                  dropPosition={
                    dropHint?.sectionId === section.id && draggingSectionId !== section.id
                      ? dropHint.position
                      : null
                  }
                  onSectionDragStart={(id) => {
                    setDraggingSectionId(id)
                    setDropHint(null)
                  }}
                  onSectionDragEnd={() => {
                    setDraggingSectionId(null)
                    setDropHint(null)
                  }}
                  onSectionDragOver={(id, position) => {
                    if (!draggingSectionId || draggingSectionId === id) return
                    setDropHint({ sectionId: id, position })
                  }}
                  onSectionDrop={handleSectionDrop}
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
          Section <code>label</code> / <code>containerMode</code> / Section Styles (
          <code>backgroundColor</code> · <code>textColor</code>) / <code>cssClass</code> and slot{' '}
          <code>name</code> save on blur/change. Section <code>order</code> persists on drag.
          Widths are integer percents inside the section container. Full Section Styles (image /
          overlay / gradients) and breakpoints live under Styles (
          <code>/app/admin/breakpoints</code>). See <code>src/core/modules/README.md</code>.
        </p>
      </details>
    </div>
  )
}

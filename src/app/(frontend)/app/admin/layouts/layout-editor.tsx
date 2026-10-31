'use client'

import React, { useActionState, useCallback, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  addLayoutRowAction,
  addLayoutSectionAction,
  dropParticleIntoRowAction,
  removeLayoutRowAction,
  removeSlotAction,
  reorderLayoutSectionsAction,
  reorderRowSlotsAction,
  resetLayoutToDefaultAction,
  resizeAdjacentSlotsAction,
  toggleSlotAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import {
  gridWidthPercent,
  LAYOUT_WIDTH_FULL,
  LAYOUT_WIDTH_MIN,
  resizeAdjacentPair,
  sumRowWidths,
  widthToPercentLabel,
} from '@/core/modules/grid'
import type { LayoutDocument, LayoutRow, LayoutSection, LayoutSlot } from '@/core/modules/types'

import { CustomParticleEditor } from './custom-particle-editor'
import { TypedParticleEditor } from './typed-particle-editors'

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
}

const initialState: LayoutActionState = {}

const DND_PARTICLE = 'application/x-starforge-particle'
const DND_SECTION = 'application/x-starforge-section'
/** Existing row particle being reordered (same row). */
const DND_SLOT = 'application/x-starforge-slot'

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

function sortSections(sections: LayoutSection[]) {
  return [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
}

function sortRows(rows: LayoutRow[]) {
  return [...rows].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
}

function sortSlots(slots: LayoutSlot[]) {
  return [...slots].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
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
  percent,
  isDragging,
  dropEdge,
  onSlotDragStart,
  onSlotDragEnd,
  onSlotDragOver,
  onSlotDrop,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  modules: ModuleOption[]
  percent: number
  isDragging: boolean
  dropEdge: 'before' | 'after' | null
  onSlotDragStart: (slotId: string) => void
  onSlotDragEnd: () => void
  onSlotDragOver: (slotId: string, edge: 'before' | 'after') => void
  onSlotDrop: (targetSlotId: string, edge: 'before' | 'after') => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [flash, setFlash] = useState<LayoutActionState>({})
  const meta = modules.find((m) => m.id === slot.moduleId)
  const enabled = slot.enabled !== false
  const pctLabel = widthToPercentLabel(slot.width)

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
        if (![...event.dataTransfer.types].includes(DND_SLOT)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
        const rect = event.currentTarget.getBoundingClientRect()
        const mid = rect.left + rect.width / 2
        onSlotDragOver(slot.id, event.clientX < mid ? 'before' : 'after')
      }}
      onDrop={(event) => {
        if (![...event.dataTransfer.types].includes(DND_SLOT)) return
        event.preventDefault()
        event.stopPropagation()
        const rect = event.currentTarget.getBoundingClientRect()
        const mid = rect.left + rect.width / 2
        onSlotDrop(slot.id, event.clientX < mid ? 'before' : 'after')
      }}
    >
      <header className="gantry-slot-head">
        <div className="gantry-slot-title">
          <button
            type="button"
            className="gantry-slot-handle"
            draggable
            title="Drag to reorder in this row"
            aria-label={`Drag to reorder ${meta?.name ?? slot.moduleId}`}
            onDragStart={(event) => {
              event.stopPropagation()
              event.dataTransfer.setData(DND_SLOT, slot.id)
              event.dataTransfer.setData('text/plain', slot.id)
              event.dataTransfer.effectAllowed = 'move'
              onSlotDragStart(slot.id)
            }}
            onDragEnd={(event) => {
              event.stopPropagation()
              onSlotDragEnd()
            }}
          >
            ⋮⋮
          </button>
          <strong>{meta?.name ?? slot.moduleId}</strong>
        </div>
        <span className="gantry-slot-pct" title={`Width ${pctLabel} (min ${LAYOUT_WIDTH_MIN}%)`}>
          {pctLabel}
        </span>
      </header>
      <p className="gantry-slot-meta">
        <code>{slot.moduleId}</code>
        {meta?.builtin ? <span className="admin-badge">built-in</span> : null}
        {!enabled ? <span className="admin-badge admin-badge-warn">off</span> : null}
      </p>
      <div className="gantry-slot-actions">
        <button
          type="button"
          className="secondary"
          disabled={pending}
          onClick={() => {
            const fd = new FormData()
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
        <button
          type="button"
          className="danger"
          disabled={pending}
          onClick={() => {
            const fd = new FormData()
            fd.set('sectionId', sectionId)
            fd.set('rowId', rowId)
            fd.set('slotId', slot.id)
            startTransition(async () => {
              const result = await removeSlotAction({}, fd)
              setFlash(result)
              router.refresh()
            })
          }}
        >
          Remove
        </button>
      </div>
      {slot.moduleId === 'custom' ? (
        <CustomParticleEditor sectionId={sectionId} rowId={rowId} slot={slot} />
      ) : (
        <TypedParticleEditor sectionId={sectionId} rowId={rowId} slot={slot} />
      )}
      <ActionFeedback state={flash} />
    </article>
  )
}

function DropRow({
  sectionId,
  row,
  modules,
  localSlots,
  setLocalSlots,
}: {
  sectionId: string
  row: LayoutRow
  modules: ModuleOption[]
  localSlots: LayoutSlot[]
  setLocalSlots: (slots: LayoutSlot[]) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dropActive, setDropActive] = useState(false)
  const [flash, setFlash] = useState<LayoutActionState>({})
  const [removeRowState, removeRowAction, removeRowPending] = useActionState(
    removeLayoutRowAction,
    initialState,
  )

  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null)
  const [slotDropHint, setSlotDropHint] = useState<{
    slotId: string
    edge: 'before' | 'after'
  } | null>(null)

  const slots = sortSlots(localSlots)
  const widthSum = sumRowWidths(slots.map((s) => s.width))

  const persistDrop = useCallback(
    (moduleId: string, index?: number) => {
      const fd = new FormData()
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
    [row.id, router, sectionId],
  )

  const persistSlotOrder = useCallback(
    (ordered: LayoutSlot[]) => {
      const fd = new FormData()
      fd.set('sectionId', sectionId)
      fd.set('rowId', row.id)
      fd.set('orderJson', JSON.stringify(ordered.map((s) => s.id)))
      startTransition(async () => {
        const result = await reorderRowSlotsAction({}, fd)
        setFlash(result)
        router.refresh()
      })
    },
    [row.id, router, sectionId],
  )

  const handleSlotDrop = useCallback(
    (targetSlotId: string, edge: 'before' | 'after') => {
      if (!draggingSlotId) {
        setSlotDropHint(null)
        return
      }
      const sorted = sortSlots(localSlots)
      const targetIndex = sorted.findIndex((s) => s.id === targetSlotId)
      if (targetIndex < 0) {
        setDraggingSlotId(null)
        setSlotDropHint(null)
        return
      }
      const destIndex = edge === 'before' ? targetIndex : targetIndex + 1
      const fromIndex = sorted.findIndex((s) => s.id === draggingSlotId)
      // No-op when dropping onto own edges that keep the same position.
      if (
        fromIndex < 0 ||
        destIndex === fromIndex ||
        destIndex === fromIndex + 1
      ) {
        setDraggingSlotId(null)
        setSlotDropHint(null)
        return
      }
      const next = moveSlotInOrder(localSlots, draggingSlotId, destIndex)
      setLocalSlots(next)
      setDraggingSlotId(null)
      setSlotDropHint(null)
      persistSlotOrder(next)
    },
    [draggingSlotId, localSlots, persistSlotOrder, setLocalSlots],
  )

  const commitResize = useCallback(
    (leftId: string, leftWidth: number, rightId: string, rightWidth: number) => {
      const fd = new FormData()
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
    [localSlots, row.id, router, sectionId, setLocalSlots],
  )

  return (
    <div
      className={dropActive ? 'gantry-row is-drop-target' : 'gantry-row'}
      data-sf-row={row.id}
      onDragOver={(event) => {
        if (![...event.dataTransfer.types].includes(DND_PARTICLE)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setDropActive(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        setDropActive(false)
        setSlotDropHint(null)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDropActive(false)
        setSlotDropHint(null)
        // Palette particle into row (not an in-row reorder payload).
        const moduleId = event.dataTransfer.getData(DND_PARTICLE)
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
          {slots.length >= 2 ? (
            <span className="layout-muted"> · drag ⋮⋮ to reorder · resize 5%–95%</span>
          ) : null}
          {pending ? <span className="layout-muted"> · saving…</span> : null}
        </span>
        <div className="gantry-row-actions">
          <form action={removeRowAction}>
            <input type="hidden" name="sectionId" value={sectionId} />
            <input type="hidden" name="rowId" value={row.id} />
            <button type="submit" className="danger" disabled={removeRowPending}>
              Remove row
            </button>
          </form>
        </div>
      </div>

      <div className="gantry-row-slots">
        {slots.length === 0 ? (
          <div className="gantry-row-empty">Drag a particle from the left into this row</div>
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
                  percent={percent}
                  isDragging={draggingSlotId === slot.id}
                  dropEdge={
                    slotDropHint?.slotId === slot.id && draggingSlotId !== slot.id
                      ? slotDropHint.edge
                      : null
                  }
                  onSlotDragStart={(id) => {
                    setDraggingSlotId(id)
                    setSlotDropHint(null)
                  }}
                  onSlotDragEnd={() => {
                    setDraggingSlotId(null)
                    setSlotDropHint(null)
                  }}
                  onSlotDragOver={(id, edge) => {
                    if (!draggingSlotId || draggingSlotId === id) return
                    setSlotDropHint({ slotId: id, edge })
                  }}
                  onSlotDrop={handleSlotDrop}
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
  isDraggingSection,
  dropPosition,
  onSectionDragStart,
  onSectionDragEnd,
  onSectionDragOver,
  onSectionDrop,
}: {
  section: LayoutSection
  modules: ModuleOption[]
  isDraggingSection: boolean
  dropPosition: 'before' | 'after' | null
  onSectionDragStart: (sectionId: string) => void
  onSectionDragEnd: () => void
  onSectionDragOver: (sectionId: string, position: 'before' | 'after') => void
  onSectionDrop: (targetSectionId: string, position: 'before' | 'after') => void
}) {
  const [rowState, rowAction, rowPending] = useActionState(addLayoutRowAction, initialState)
  const rows = sortRows(section.rows)
  const [slotMap, setSlotMap] = useState<Record<string, LayoutSlot[]>>(() => {
    const map: Record<string, LayoutSlot[]> = {}
    for (const row of section.rows) map[row.id] = sortSlots(row.slots)
    return map
  })

  // Keep local map in sync when server document refreshes.
  React.useEffect(() => {
    const map: Record<string, LayoutSlot[]> = {}
    for (const row of section.rows) map[row.id] = sortSlots(row.slots)
    setSlotMap(map)
  }, [section])

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
          <div>
            <h3>{section.label}</h3>
            <code className="layout-id">{section.id}</code>
          </div>
        </div>
        <form action={rowAction} className="gantry-section-actions">
          <input type="hidden" name="sectionId" value={section.id} />
          <button type="submit" className="secondary" disabled={rowPending}>
            {rowPending ? 'Adding…' : 'Add row'}
          </button>
        </form>
      </header>
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
export function LayoutEditor({ document, source, modules }: Props) {
  const router = useRouter()
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

  React.useEffect(() => {
    setSectionList(sortSections(document.sections))
  }, [document.sections])

  const persistSectionOrder = useCallback(
    (ordered: LayoutSection[]) => {
      const fd = new FormData()
      fd.set('orderJson', JSON.stringify(ordered.map((s) => s.id)))
      startSectionSave(async () => {
        const result = await reorderLayoutSectionsAction({}, fd)
        setReorderFlash(result)
        router.refresh()
      })
    },
    [router],
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
          <p className="layout-muted">Drag a particle onto a row on the canvas.</p>
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
                  onDragStart={(event) => {
                    event.dataTransfer.setData(DND_PARTICLE, mod.id)
                    event.dataTransfer.setData('text/plain', mod.id)
                    event.dataTransfer.effectAllowed = 'copy'
                    setDraggingParticleId(mod.id)
                  }}
                  onDragEnd={() => setDraggingParticleId(null)}
                >
                  <strong>{mod.name}</strong>
                  <span>{mod.description || mod.id}</span>
                  {mod.builtin ? <em>built-in</em> : null}
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <div className="gantry-canvas" aria-label="Layout canvas">
          <div className="gantry-canvas-toolbar">
            <form action={sectionAction} className="layout-inline-form">
              <input type="text" name="label" placeholder="New section name" required />
              <button type="submit" disabled={sectionPending}>
                {sectionPending ? 'Adding…' : 'Create section'}
              </button>
            </form>
            <form action={resetAction}>
              <button type="submit" className="secondary" disabled={resetPending}>
                {resetPending ? 'Resetting…' : 'Reset to default'}
              </button>
            </form>
          </div>
          <ActionFeedback state={sectionState} />
          <ActionFeedback state={resetState} />
          <ActionFeedback state={reorderFlash} />
          {sectionPendingSave ? <p className="layout-muted">Saving section order…</p> : null}

          <ol className="gantry-howto">
            <li>
              Create a <strong>section</strong> — drag the <strong>⋮⋮</strong> handle to reorder
            </li>
            <li>Add a <strong>row</strong> inside it</li>
            <li>
              <strong>Drag</strong> a particle from the left into the row
            </li>
            <li>
              Drop another beside it (side-by-side), then <strong>drag the divider</strong> — 1%
              steps, 5%–95%, pair sums to 100%
            </li>
          </ol>

          {sectionList.length === 0 ? (
            <p className="admin-empty">No sections yet — create one to start.</p>
          ) : (
            <ol className="gantry-sections">
              {sectionList.map((section) => (
                <SectionCanvas
                  key={section.id}
                  section={section}
                  modules={modules}
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
          Section <code>order</code> is persisted when you drag sections. Widths are integer
          percents. Custom uses CodeMirror. Styles / Outlines / Menu remain next polish — see{' '}
          <code>src/core/modules/README.md</code>.
        </p>
      </details>
    </div>
  )
}

'use client'

import React, { useActionState, useCallback, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  addLayoutRowAction,
  addLayoutSectionAction,
  dropParticleIntoRowAction,
  removeLayoutRowAction,
  removeSlotAction,
  resetLayoutToDefaultAction,
  resizeAdjacentSlotsAction,
  toggleSlotAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import { gridWidthPercent, resizeAdjacentPair, sumRowWidths, widthToPercentLabel } from '@/core/modules/grid'
import {
  LAYOUT_GRID_COLUMNS,
  type LayoutDocument,
  type LayoutRow,
  type LayoutSection,
  type LayoutSlot,
} from '@/core/modules/types'

import { CustomParticleEditor } from './custom-particle-editor'

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
          const pairWidthPx = Math.max(1, (pairSum / LAYOUT_GRID_COLUMNS) * rowRect.width)
          const localX = x - pairLeft
          const newLeftCols = (localX / pairWidthPx) * pairSum
          const [lw, rw] = resizeAdjacentPair(left.width, right.width, newLeftCols)
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
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  modules: ModuleOption[]
  percent: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [flash, setFlash] = useState<LayoutActionState>({})
  const meta = modules.find((m) => m.id === slot.moduleId)
  const enabled = slot.enabled !== false
  const pctLabel = widthToPercentLabel(slot.width)

  return (
    <article
      className="gantry-slot"
      data-enabled={enabled ? 'true' : 'false'}
      data-sf-width={slot.width}
      data-sf-slot={slot.id}
      style={{
        flex: `0 0 ${percent}%`,
        maxWidth: `${percent}%`,
        width: `${percent}%`,
      }}
    >
      <header className="gantry-slot-head">
        <strong>{meta?.name ?? slot.moduleId}</strong>
        <span className="gantry-slot-pct" title={`${slot.width}/12 columns`}>
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
      ) : null}
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
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDropActive(false)
        const moduleId = event.dataTransfer.getData(DND_PARTICLE) || event.dataTransfer.getData('text/plain')
        if (!moduleId) return
        persistDrop(moduleId)
      }}
    >
      <div className="gantry-row-meta">
        <span>
          Row · drop particles here
          {slots.length > 0 ? (
            <>
              {' '}
              · {Math.round((widthSum / LAYOUT_GRID_COLUMNS) * 100)}% filled ({widthSum}/12)
            </>
          ) : null}
          {widthSum > LAYOUT_GRID_COLUMNS ? (
            <span className="admin-badge admin-badge-warn"> overflows</span>
          ) : null}
          {pending ? <span className="layout-muted"> · saving…</span> : null}
        </span>
        <form action={removeRowAction}>
          <input type="hidden" name="sectionId" value={sectionId} />
          <input type="hidden" name="rowId" value={row.id} />
          <button type="submit" className="danger" disabled={removeRowPending}>
            Remove row
          </button>
        </form>
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
}: {
  section: LayoutSection
  modules: ModuleOption[]
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

  return (
    <li className="gantry-section">
      <header className="gantry-section-head">
        <div>
          <h3>{section.label}</h3>
          <code className="layout-id">{section.id}</code>
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
 * 4) Drop another beside it and resize by % (12-col under the hood).
 */
export function LayoutEditor({ document, source, modules }: Props) {
  const [sectionState, sectionAction, sectionPending] = useActionState(
    addLayoutSectionAction,
    initialState,
  )
  const [resetState, resetAction, resetPending] = useActionState(
    resetLayoutToDefaultAction,
    initialState,
  )
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const sections = sortSections(document.sections)

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
        : <strong>section → row → drag particles</strong>, resize side-by-side by %.
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
                    draggingId === mod.id
                      ? 'gantry-palette-item is-dragging'
                      : 'gantry-palette-item'
                  }
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(DND_PARTICLE, mod.id)
                    event.dataTransfer.setData('text/plain', mod.id)
                    event.dataTransfer.effectAllowed = 'copy'
                    setDraggingId(mod.id)
                  }}
                  onDragEnd={() => setDraggingId(null)}
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

          <ol className="gantry-howto">
            <li>Create a <strong>section</strong></li>
            <li>Add a <strong>row</strong> inside it</li>
            <li>
              <strong>Drag</strong> a particle from the left into the row
            </li>
            <li>
              Drop another beside it, then <strong>drag the divider</strong> to resize by %
            </li>
          </ol>

          {sections.length === 0 ? (
            <p className="admin-empty">No sections yet — create one to start.</p>
          ) : (
            <ol className="gantry-sections">
              {sections.map((section) => (
                <SectionCanvas key={section.id} section={section} modules={modules} />
              ))}
            </ol>
          )}
        </div>
      </div>

      <details className="layout-json-preview">
        <summary>Layout document (JSON storage)</summary>
        <pre>{JSON.stringify(document, null, 2)}</pre>
        <p className="layout-muted">
          Widths are stored as 1–12 columns and shown as % on the canvas. Custom particle still uses
          CodeMirror. Styles / Outlines / Menu editors remain next polish — see{' '}
          <code>src/core/modules/README.md</code>.
        </p>
      </details>
    </div>
  )
}

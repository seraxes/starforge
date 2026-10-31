'use client'

import React, { useActionState, useMemo, useState } from 'react'

import {
  addLayoutRowAction,
  addLayoutSectionAction,
  addParticleToSectionAction,
  removeLayoutRowAction,
  removeSlotAction,
  resetLayoutToDefaultAction,
  setSlotWidthAction,
  toggleSlotAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import { sumRowWidths } from '@/core/modules/grid'
import { LAYOUT_GRID_COLUMNS, type LayoutDocument, type LayoutSlot } from '@/core/modules/types'

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

const WIDTH_OPTIONS = Array.from({ length: LAYOUT_GRID_COLUMNS }, (_, i) => i + 1)

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

function WidthBar({ width }: { width: number }) {
  return (
    <div className="gantry-width-bar" aria-hidden="true">
      {WIDTH_OPTIONS.map((n) => (
        <span key={n} className={n <= width ? 'is-filled' : undefined} />
      ))}
    </div>
  )
}

function SlotCard({
  sectionId,
  rowId,
  slot,
  modules,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  modules: ModuleOption[]
}) {
  const [widthState, widthAction, widthPending] = useActionState(setSlotWidthAction, initialState)
  const [toggleState, toggleAction, togglePending] = useActionState(toggleSlotAction, initialState)
  const [removeState, removeAction, removePending] = useActionState(removeSlotAction, initialState)
  const meta = modules.find((m) => m.id === slot.moduleId)
  const enabled = slot.enabled !== false

  return (
    <article
      className="gantry-slot"
      data-enabled={enabled ? 'true' : 'false'}
      style={{ flex: `0 0 ${(slot.width / LAYOUT_GRID_COLUMNS) * 100}%`, maxWidth: `${(slot.width / LAYOUT_GRID_COLUMNS) * 100}%` }}
    >
      <header className="gantry-slot-head">
        <strong>{meta?.name ?? slot.moduleId}</strong>
        <code>{slot.moduleId}</code>
        {!enabled ? <span className="admin-badge admin-badge-warn">off</span> : null}
        {meta?.builtin ? <span className="admin-badge">built-in</span> : null}
      </header>
      <WidthBar width={slot.width} />
      <form action={widthAction} className="gantry-width-form">
        <input type="hidden" name="sectionId" value={sectionId} />
        <input type="hidden" name="rowId" value={rowId} />
        <input type="hidden" name="slotId" value={slot.id} />
        <label>
          <span className="sr-only">Width</span>
          <select name="width" defaultValue={slot.width} disabled={widthPending}>
            {WIDTH_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}/12
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="secondary" disabled={widthPending}>
          Set width
        </button>
      </form>
      <div className="gantry-slot-actions">
        <form action={toggleAction}>
          <input type="hidden" name="sectionId" value={sectionId} />
          <input type="hidden" name="rowId" value={rowId} />
          <input type="hidden" name="slotId" value={slot.id} />
          <button type="submit" className="secondary" disabled={togglePending}>
            {enabled ? 'Disable' : 'Enable'}
          </button>
        </form>
        <form action={removeAction}>
          <input type="hidden" name="sectionId" value={sectionId} />
          <input type="hidden" name="rowId" value={rowId} />
          <input type="hidden" name="slotId" value={slot.id} />
          <button type="submit" className="danger" disabled={removePending}>
            Remove
          </button>
        </form>
      </div>
      {slot.moduleId === 'custom' ? (
        <CustomParticleEditor sectionId={sectionId} rowId={rowId} slot={slot} />
      ) : null}
      <ActionFeedback
        state={widthState.error ? widthState : toggleState.error ? toggleState : removeState}
      />
    </article>
  )
}

export function LayoutEditor({ document, source, modules }: Props) {
  const [selectedModuleId, setSelectedModuleId] = useState<string>(modules[0]?.id ?? '')
  const [selectedWidth, setSelectedWidth] = useState<number>(12)
  const [addState, addAction, addPending] = useActionState(addParticleToSectionAction, initialState)
  const [sectionState, sectionAction, sectionPending] = useActionState(
    addLayoutSectionAction,
    initialState,
  )
  const [rowState, rowAction, rowPending] = useActionState(addLayoutRowAction, initialState)
  const [resetState, resetAction, resetPending] = useActionState(
    resetLayoutToDefaultAction,
    initialState,
  )
  const [removeRowState, removeRowAction] = useActionState(removeLayoutRowAction, initialState)

  const selectedModule = useMemo(
    () => modules.find((m) => m.id === selectedModuleId),
    [modules, selectedModuleId],
  )

  const sections = [...document.sections].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
  )

  return (
    <div className="gantry-editor">
      <p className="layout-source">
        Source:{' '}
        <strong>{source === 'database' ? 'Database (sf_layouts)' : 'Default JSON fallback'}</strong>
        {source === 'default-json'
          ? ' — first edit writes the document to Postgres.'
          : null}{' '}
        Storage is JSON (12-col widths). Model follows{' '}
        <a href="https://docs.gantry.org/gantry5/configure/layout-manager" target="_blank" rel="noreferrer">
          Gantry Layout Manager
        </a>
        : particles → sections. v1 is click-to-add (drag-drop next).
      </p>

      <div className="gantry-workspace">
        <aside className="gantry-palette" aria-label="Available particles">
          <h3>Particles</h3>
          <p className="layout-muted">Select, then add to a section (or row).</p>
          <ul className="gantry-palette-list">
            {modules.map((mod) => (
              <li key={mod.id}>
                <button
                  type="button"
                  className={
                    selectedModuleId === mod.id
                      ? 'gantry-palette-item is-selected'
                      : 'gantry-palette-item'
                  }
                  onClick={() => {
                    setSelectedModuleId(mod.id)
                    setSelectedWidth(mod.defaultWidth || 12)
                  }}
                >
                  <strong>{mod.name}</strong>
                  <span>{mod.description || mod.id}</span>
                  {mod.builtin ? <em>built-in</em> : null}
                </button>
              </li>
            ))}
          </ul>
          <label className="gantry-palette-width">
            <span>Default width</span>
            <select
              value={selectedWidth}
              onChange={(e) => setSelectedWidth(Number(e.target.value))}
            >
              {WIDTH_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}/12
                </option>
              ))}
            </select>
          </label>
          <p className="layout-muted">
            Selected: <strong>{selectedModule?.name ?? '—'}</strong>
          </p>
        </aside>

        <div className="gantry-canvas" aria-label="Layout canvas">
          <div className="gantry-canvas-toolbar">
            <form action={sectionAction} className="layout-inline-form">
              <input type="text" name="label" placeholder="New section name" required />
              <button type="submit" disabled={sectionPending}>
                {sectionPending ? 'Adding…' : 'Add section'}
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
          <ActionFeedback state={addState} />
          <ActionFeedback state={rowState} />
          <ActionFeedback state={removeRowState} />

          {sections.length === 0 ? (
            <p className="admin-empty">No sections — add one to start the canvas.</p>
          ) : (
            <ol className="gantry-sections">
              {sections.map((section) => {
                const rows = [...section.rows].sort(
                  (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
                )
                return (
                  <li key={section.id} className="gantry-section">
                    <header className="gantry-section-head">
                      <div>
                        <h3>{section.label}</h3>
                        <code className="layout-id">{section.id}</code>
                      </div>
                      <div className="gantry-section-actions">
                        <form action={addAction}>
                          <input type="hidden" name="sectionId" value={section.id} />
                          <input type="hidden" name="moduleId" value={selectedModuleId} />
                          <input type="hidden" name="width" value={selectedWidth} />
                          <button type="submit" disabled={addPending || !selectedModuleId}>
                            {addPending ? 'Adding…' : `Add ${selectedModule?.name ?? 'particle'}`}
                          </button>
                        </form>
                        <form action={rowAction}>
                          <input type="hidden" name="sectionId" value={section.id} />
                          <button type="submit" className="secondary" disabled={rowPending}>
                            Add row
                          </button>
                        </form>
                      </div>
                    </header>

                    {rows.length === 0 ? (
                      <p className="layout-muted">Empty section — add a particle or row.</p>
                    ) : (
                      rows.map((row) => {
                        const slots = [...row.slots].sort(
                          (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
                        )
                        const widthSum = sumRowWidths(slots.map((s) => s.width))
                        return (
                          <div key={row.id} className="gantry-row" data-sf-row={row.id}>
                            <div className="gantry-row-meta">
                              <span>
                                Row · {widthSum}/12
                                {widthSum > LAYOUT_GRID_COLUMNS ? (
                                  <span className="admin-badge admin-badge-warn"> overflows</span>
                                ) : null}
                              </span>
                              <div className="gantry-row-actions">
                                <form action={addAction}>
                                  <input type="hidden" name="sectionId" value={section.id} />
                                  <input type="hidden" name="rowId" value={row.id} />
                                  <input type="hidden" name="moduleId" value={selectedModuleId} />
                                  <input type="hidden" name="width" value={selectedWidth} />
                                  <button
                                    type="submit"
                                    className="secondary"
                                    disabled={addPending || !selectedModuleId}
                                  >
                                    Add here
                                  </button>
                                </form>
                                <form action={removeRowAction}>
                                  <input type="hidden" name="sectionId" value={section.id} />
                                  <input type="hidden" name="rowId" value={row.id} />
                                  <button type="submit" className="danger">
                                    Remove row
                                  </button>
                                </form>
                              </div>
                            </div>
                            <div className="gantry-row-slots">
                              {slots.length === 0 ? (
                                <p className="layout-muted">Drop particles here via Add.</p>
                              ) : (
                                slots.map((slot) => (
                                  <SlotCard
                                    key={slot.id}
                                    sectionId={section.id}
                                    rowId={row.id}
                                    slot={slot}
                                    modules={modules}
                                  />
                                ))
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>

      <details className="layout-json-preview">
        <summary>Layout document (JSON storage)</summary>
        <pre>{JSON.stringify(document, null, 2)}</pre>
        <p className="layout-muted">
          Gantry-like model: left palette = particles; canvas = sections → rows → slots with{' '}
          <code>width</code> 1–12 (Starforge grid math, not Bootstrap). Custom uses CodeMirror
          (not plain textareas). Next polish: drag-drop, Styles / Outlines / Menu editor, block
          settings (CSS classes, variations), YAML export, developer-admin JS ACL — see{' '}
          <code>src/core/modules/README.md</code>.
        </p>
      </details>
    </div>
  )
}

'use client'

import React, { useActionState } from 'react'

import {
  addLayoutPositionAction,
  addLayoutSectionAction,
  assignModuleToPositionAction,
  removeModuleFromPositionAction,
  renameLayoutPositionAction,
  renameLayoutSectionAction,
  resetLayoutToDefaultAction,
  toggleModuleAssignmentAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import type { LayoutDocument } from '@/core/modules/types'

type ModuleOption = {
  id: string
  name: string
  description: string
}

type Props = {
  document: LayoutDocument
  source: 'database' | 'default-json'
  modules: ModuleOption[]
}

const initialState: LayoutActionState = {}

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

function AddSectionForm() {
  const [state, formAction, pending] = useActionState(addLayoutSectionAction, initialState)

  return (
    <form action={formAction} className="layout-inline-form">
      <label>
        <span className="sr-only">New section name</span>
        <input type="text" name="label" placeholder="Section name" required autoComplete="off" />
      </label>
      <label className="layout-check">
        <input type="checkbox" name="content" value="true" />
        <span>Contains page content</span>
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add section'}
      </button>
      <ActionFeedback state={state} />
    </form>
  )
}

function RenameSectionForm({ sectionId, label }: { sectionId: string; label: string }) {
  const [state, formAction, pending] = useActionState(renameLayoutSectionAction, initialState)

  return (
    <form action={formAction} className="layout-inline-form layout-rename-form">
      <input type="hidden" name="sectionId" value={sectionId} />
      <label>
        <span className="sr-only">Rename section</span>
        <input type="text" name="label" defaultValue={label} required autoComplete="off" />
      </label>
      <button type="submit" className="secondary" disabled={pending}>
        {pending ? 'Saving…' : 'Rename'}
      </button>
      <ActionFeedback state={state} />
    </form>
  )
}

function AddPositionForm({
  sectionId,
  contentSection,
}: {
  sectionId: string
  contentSection: boolean
}) {
  const [state, formAction, pending] = useActionState(addLayoutPositionAction, initialState)

  return (
    <form action={formAction} className="layout-inline-form">
      <input type="hidden" name="sectionId" value={sectionId} />
      <label>
        <span className="sr-only">New position name</span>
        <input type="text" name="label" placeholder="Position name" required autoComplete="off" />
      </label>
      {contentSection ? (
        <label>
          <span className="sr-only">Placement</span>
          <select name="placement" defaultValue="after">
            <option value="before">Before content</option>
            <option value="after">After content</option>
          </select>
        </label>
      ) : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add position'}
      </button>
      <ActionFeedback state={state} />
    </form>
  )
}

function RenamePositionForm({
  sectionId,
  positionId,
  label,
}: {
  sectionId: string
  positionId: string
  label: string
}) {
  const [state, formAction, pending] = useActionState(renameLayoutPositionAction, initialState)

  return (
    <form action={formAction} className="layout-inline-form layout-rename-form">
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="positionId" value={positionId} />
      <label>
        <span className="sr-only">Rename position</span>
        <input type="text" name="label" defaultValue={label} required autoComplete="off" />
      </label>
      <button type="submit" className="secondary" disabled={pending}>
        {pending ? 'Saving…' : 'Rename'}
      </button>
      <ActionFeedback state={state} />
    </form>
  )
}

function AssignModuleForm({
  sectionId,
  positionId,
  modules,
  assignedIds,
}: {
  sectionId: string
  positionId: string
  modules: ModuleOption[]
  assignedIds: string[]
}) {
  const [state, formAction, pending] = useActionState(assignModuleToPositionAction, initialState)
  const available = modules.filter((m) => !assignedIds.includes(m.id))

  if (available.length === 0) {
    return <p className="layout-muted">All registered modules are already assigned here.</p>
  }

  return (
    <form action={formAction} className="layout-inline-form">
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="positionId" value={positionId} />
      <label>
        <span className="sr-only">Module</span>
        <select name="moduleId" required defaultValue="">
          <option value="" disabled>
            Assign module…
          </option>
          {available.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.id})
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Assigning…' : 'Assign'}
      </button>
      <ActionFeedback state={state} />
    </form>
  )
}

function ModuleAssignmentRow({
  sectionId,
  positionId,
  moduleId,
  enabled,
  modules,
}: {
  sectionId: string
  positionId: string
  moduleId: string
  enabled: boolean
  modules: ModuleOption[]
}) {
  const [toggleState, toggleAction, togglePending] = useActionState(
    toggleModuleAssignmentAction,
    initialState,
  )
  const [removeState, removeAction, removePending] = useActionState(
    removeModuleFromPositionAction,
    initialState,
  )
  const meta = modules.find((m) => m.id === moduleId)

  return (
    <li className="layout-module-row" data-enabled={enabled ? 'true' : 'false'}>
      <div>
        <strong>{meta?.name ?? moduleId}</strong>
        <code className="layout-id">{moduleId}</code>
        {enabled ? null : <span className="admin-badge admin-badge-warn">off</span>}
      </div>
      <div className="layout-module-actions">
        <form action={toggleAction}>
          <input type="hidden" name="sectionId" value={sectionId} />
          <input type="hidden" name="positionId" value={positionId} />
          <input type="hidden" name="moduleId" value={moduleId} />
          <button type="submit" className="secondary" disabled={togglePending}>
            {enabled ? 'Disable' : 'Enable'}
          </button>
        </form>
        <form action={removeAction}>
          <input type="hidden" name="sectionId" value={sectionId} />
          <input type="hidden" name="positionId" value={positionId} />
          <input type="hidden" name="moduleId" value={moduleId} />
          <button type="submit" className="danger" disabled={removePending}>
            Remove
          </button>
        </form>
      </div>
      <ActionFeedback state={toggleState.error ? toggleState : removeState} />
    </li>
  )
}

function ResetLayoutForm() {
  const [state, formAction, pending] = useActionState(resetLayoutToDefaultAction, initialState)

  return (
    <form action={formAction} className="layout-reset-form">
      <button type="submit" className="secondary" disabled={pending}>
        {pending ? 'Resetting…' : 'Reset to default layout'}
      </button>
      <ActionFeedback state={state} />
    </form>
  )
}

export function LayoutEditor({ document, source, modules }: Props) {
  const sections = [...document.sections].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
  )

  return (
    <div className="layout-editor">
      <p className="layout-source">
        Source:{' '}
        <strong>{source === 'database' ? 'Database (sf_layouts)' : 'Default JSON fallback'}</strong>
        {source === 'default-json'
          ? ' — first save (add a section/position or reset) writes the document to Postgres.'
          : null}
      </p>

      <div className="layout-toolbar">
        <AddSectionForm />
        <ResetLayoutForm />
      </div>

      {sections.length === 0 ? (
        <p className="admin-empty">No sections yet. Add a section to start the layout.</p>
      ) : (
        <ol className="layout-sections">
          {sections.map((section) => {
            const positions = [...section.positions].sort(
              (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
            )
            return (
              <li key={section.id} className="layout-section-card">
                <header className="layout-section-head">
                  <div>
                    <h3>{section.label}</h3>
                    <p className="layout-meta">
                      <code className="layout-id">{section.id}</code>
                      {section.content ? <span className="admin-badge">page content</span> : null}
                    </p>
                  </div>
                  <RenameSectionForm sectionId={section.id} label={section.label} />
                </header>

                <div className="layout-positions">
                  {positions.length === 0 ? (
                    <p className="layout-muted">No positions in this section yet.</p>
                  ) : (
                    positions.map((position) => {
                      const assignedIds = position.modules.map((m) => m.moduleId)
                      return (
                        <article key={position.id} className="layout-position-card">
                          <header className="layout-position-head">
                            <div>
                              <h4>{position.label}</h4>
                              <p className="layout-meta">
                                <code className="layout-id">{position.id}</code>
                                {position.placement ? (
                                  <span className="admin-badge">{position.placement} content</span>
                                ) : null}
                              </p>
                            </div>
                            <RenamePositionForm
                              sectionId={section.id}
                              positionId={position.id}
                              label={position.label}
                            />
                          </header>

                          {position.modules.length === 0 ? (
                            <p className="layout-muted">No modules assigned.</p>
                          ) : (
                            <ul className="layout-module-list">
                              {[...position.modules]
                                .sort(
                                  (a, b) =>
                                    (a.order ?? 0) - (b.order ?? 0) ||
                                    a.moduleId.localeCompare(b.moduleId),
                                )
                                .map((mod) => (
                                  <ModuleAssignmentRow
                                    key={mod.moduleId}
                                    sectionId={section.id}
                                    positionId={position.id}
                                    moduleId={mod.moduleId}
                                    enabled={mod.enabled !== false}
                                    modules={modules}
                                  />
                                ))}
                            </ul>
                          )}

                          <AssignModuleForm
                            sectionId={section.id}
                            positionId={position.id}
                            modules={modules}
                            assignedIds={assignedIds}
                          />
                        </article>
                      )
                    })
                  )}
                </div>

                <AddPositionForm sectionId={section.id} contentSection={Boolean(section.content)} />
              </li>
            )
          })}
        </ol>
      )}

      <details className="layout-json-preview">
        <summary>Layout document (JSON storage)</summary>
        <pre>{JSON.stringify(document, null, 2)}</pre>
        <p className="layout-muted">
          Visual editor is the primary UX. YAML/JSON stays the storage format for export and
          versioning — a fuller drag-drop editor and developer-admin YAML mode come later. Custom JS
          particles and Joomla-like ACL are out of scope for this foundation slice.
        </p>
      </details>
    </div>
  )
}

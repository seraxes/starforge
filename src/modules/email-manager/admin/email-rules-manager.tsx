'use client'

import React, { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog'

import {
  createEmailRuleAction,
  deleteEmailRuleAction,
  seedFormsEmailStartersAction,
  toggleEmailRuleAction,
  updateEmailRuleAction,
  type EmailAdminActionState,
} from '../actions'

type RuleRow = {
  id: string
  label: string
  moduleCategory: string
  enabled: boolean
  triggerKey: string
  mode: string
  conditionsJson: string
  audienceTo: string
  audienceToFromPayload: string
  audienceReplyTo: string
  audienceReplyToFromPayload: string
  templateId: string
  fromOverride: string
  updatedAt: string
}

type TemplateOpt = { id: string; label: string; moduleCategory: string }
type TriggerOpt = { key: string; label: string; moduleCategory: string }

type Props = {
  category: string
  categories: string[]
  rules: RuleRow[]
  templates: TemplateOpt[]
  triggers: TriggerOpt[]
}

const initial: EmailAdminActionState = {}

function Feedback({ state }: { state: EmailAdminActionState }) {
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

function formatUpdated(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime()) || d.getTime() === 0) return '—'
    return `${d.toISOString().replace('T', ' ').slice(0, 16)} UTC`
  } catch {
    return '—'
  }
}

function RuleCreateFields({
  categories,
  category,
  templates,
  triggers,
  busy,
}: {
  categories: string[]
  category: string
  templates: TemplateOpt[]
  triggers: TriggerOpt[]
  busy: boolean
}) {
  return (
    <>
      <label className="settings-field">
        <span>Label</span>
        <input
          type="text"
          name="label"
          required
          maxLength={200}
          autoComplete="off"
          disabled={busy}
        />
      </label>
      <label className="settings-field">
        <span>Module category</span>
        <select
          name="moduleCategory"
          defaultValue={category === 'all' ? 'forms' : category}
          disabled={busy}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        <span>Trigger</span>
        <select name="triggerKey" required defaultValue="product:forms/submitted" disabled={busy}>
          {triggers.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label} ({t.key})
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        <span>Mode</span>
        <select name="mode" defaultValue="conditional" disabled={busy}>
          <option value="automatic">Automatic</option>
          <option value="conditional">Conditional</option>
        </select>
      </label>
      <label className="settings-field">
        <span>Condition path (optional)</span>
        <input
          type="text"
          name="conditionPath"
          placeholder="notifyAdmin"
          autoComplete="off"
          disabled={busy}
        />
      </label>
      <label className="settings-field">
        <span>Condition op</span>
        <select name="conditionOp" defaultValue="truthy" disabled={busy}>
          <option value="truthy">truthy</option>
          <option value="falsy">falsy</option>
          <option value="eq">eq</option>
          <option value="neq">neq</option>
          <option value="contains">contains</option>
          <option value="exists">exists</option>
        </select>
      </label>
      <label className="settings-field">
        <span>Condition value</span>
        <input type="text" name="conditionValue" autoComplete="off" disabled={busy} />
      </label>
      <label className="settings-field">
        <span>To (literal emails)</span>
        <input
          type="text"
          name="audienceTo"
          placeholder="admin@example.com"
          autoComplete="off"
          disabled={busy}
        />
      </label>
      <label className="settings-field">
        <span>To from payload paths</span>
        <input
          type="text"
          name="audienceToFromPayload"
          placeholder="adminEmails, respondentEmail"
          autoComplete="off"
          disabled={busy}
        />
      </label>
      <label className="settings-field">
        <span>Template</span>
        <select name="templateId" required disabled={busy || templates.length === 0}>
          {templates.length === 0 ? (
            <option value="">Create a template first</option>
          ) : (
            templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} ({t.moduleCategory})
              </option>
            ))
          )}
        </select>
      </label>
      <label className="settings-field">
        <span>From override (optional)</span>
        <input
          type="text"
          name="fromOverride"
          placeholder="noreply@…"
          autoComplete="off"
          disabled={busy}
        />
      </label>
      <label className="settings-field settings-flag">
        <span>
          <input type="checkbox" name="enabled" value="1" defaultChecked disabled={busy} /> Enabled
        </span>
      </label>
    </>
  )
}

function RuleEditFields({
  rule,
  categories,
  templates,
  triggers,
  busy,
}: {
  rule: RuleRow
  categories: string[]
  templates: TemplateOpt[]
  triggers: TriggerOpt[]
  busy: boolean
}) {
  return (
    <>
      <label className="settings-field">
        <span>Label</span>
        <input
          type="text"
          name="label"
          defaultValue={rule.label}
          required
          maxLength={200}
          disabled={busy}
        />
      </label>
      <label className="settings-field">
        <span>Module category</span>
        <select name="moduleCategory" defaultValue={rule.moduleCategory} disabled={busy}>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        <span>Trigger</span>
        <select name="triggerKey" defaultValue={rule.triggerKey} disabled={busy}>
          {triggers.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label} ({t.key})
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        <span>Mode</span>
        <select name="mode" defaultValue={rule.mode} disabled={busy}>
          <option value="automatic">Automatic</option>
          <option value="conditional">Conditional</option>
        </select>
      </label>
      <label className="settings-field">
        <span>Conditions JSON</span>
        <textarea
          name="conditionsJson"
          rows={3}
          defaultValue={rule.conditionsJson}
          className="settings-field-mono"
          disabled={busy}
        />
      </label>
      <label className="settings-field">
        <span>To</span>
        <input type="text" name="audienceTo" defaultValue={rule.audienceTo} disabled={busy} />
      </label>
      <label className="settings-field">
        <span>To from payload</span>
        <input
          type="text"
          name="audienceToFromPayload"
          defaultValue={rule.audienceToFromPayload}
          disabled={busy}
        />
      </label>
      <label className="settings-field">
        <span>Reply-To</span>
        <input
          type="text"
          name="audienceReplyTo"
          defaultValue={rule.audienceReplyTo}
          disabled={busy}
        />
      </label>
      <label className="settings-field">
        <span>Template</span>
        <select name="templateId" defaultValue={rule.templateId} disabled={busy}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        <span>From override</span>
        <input
          type="text"
          name="fromOverride"
          defaultValue={rule.fromOverride}
          disabled={busy}
        />
      </label>
      <label className="settings-field settings-flag">
        <span>
          <input
            type="checkbox"
            name="enabled"
            value="1"
            defaultChecked={rule.enabled}
            disabled={busy}
          />{' '}
          Enabled
        </span>
      </label>
    </>
  )
}

export function EmailRulesManager({
  category,
  categories,
  rules,
  templates,
  triggers,
}: Props) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RuleRow | null>(null)

  const [createState, createAction, createPending] = useActionState(
    createEmailRuleAction,
    initial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateEmailRuleAction,
    initial,
  )
  const [toggleState, toggleAction, togglePending] = useActionState(
    toggleEmailRuleAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteEmailRuleAction,
    initial,
  )
  const [seedState, seedAction, seedPending] = useActionState(
    seedFormsEmailStartersAction,
    initial,
  )

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(toggleState)
  useNotifySavedOnOk(deleteState)
  useNotifySavedOnOk(seedState)

  useEffect(() => {
    if (createState.ok) {
      setCreateOpen(false)
      setFormKey((k) => k + 1)
      router.refresh()
    }
  }, [createState.ok, router])

  useEffect(() => {
    if (updateState.ok) {
      setEditingId(null)
      router.refresh()
    }
  }, [updateState.ok, router])

  useEffect(() => {
    if (toggleState.ok || seedState.ok) {
      router.refresh()
    }
  }, [toggleState.ok, seedState.ok, router])

  useEffect(() => {
    if (!deleteState.ok) return
    setDeleteTarget(null)
    setEditingId(null)
    router.refresh()
  }, [deleteState.ok, router])

  const busy =
    createPending || updatePending || togglePending || deletePending || seedPending
  const createFormId = 'sf-email-rule-create-form'
  const editing = editingId ? rules.find((row) => row.id === editingId) : null

  function resetCreate() {
    setCreateOpen(false)
    setFormKey((k) => k + 1)
  }

  function filterHref(next: string) {
    return next === 'all' ? '/admin/email' : `/admin/email?category=${encodeURIComponent(next)}`
  }

  return (
    <div className="sf-email-rules-manager admin-settings-mosaic">
      <section className="outlines-create sf-events-add-panel" aria-label="Add rule">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={createOpen}
            aria-controls={createFormId}
            onClick={() => {
              if (createOpen) resetCreate()
              else {
                setEditingId(null)
                setCreateOpen(true)
              }
            }}
          >
            {createOpen ? 'Close' : 'Add +'}
          </button>
          {!createOpen ? (
            <p className="settings-hint sf-events-add-hint">
              Bind a trigger to a template. Seed Forms starters below if you need the defaults.
            </p>
          ) : null}
        </div>

        {createOpen ? (
          <form
            key={formKey}
            id={createFormId}
            action={createAction}
            className="sf-events-add-inline-form"
            aria-label="Create rule"
          >
            <RuleCreateFields
              categories={categories}
              category={category}
              templates={templates}
              triggers={triggers}
              busy={busy}
            />
            <Feedback state={createState} />
            <div className="sf-events-form-actions page-settings-actions">
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={createPending}
                onClick={resetCreate}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                disabled={busy || templates.length === 0}
              >
                {createPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="outlines-create" aria-label="Forms starters">
        <h3>Forms starters</h3>
        <p className="settings-hint">
          Creates conditional admin + respondent rules on <code>product:forms/submitted</code>{' '}
          (payload paths <code>adminEmails</code> / <code>respondentEmail</code>). Safe to re-run
          to restore defaults.
        </p>
        <Feedback state={seedState} />
        <div className="sf-events-form-actions page-settings-actions">
          <form action={seedAction}>
            <button
              type="submit"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={busy}
            >
              {seedPending ? 'Seeding…' : 'Seed Forms notify rules'}
            </button>
          </form>
        </div>
      </section>

      <section className="outlines-create" aria-label="Filter rules">
        <h3>Filter</h3>
        <div className="sf-events-filters" role="group" aria-label="Module category">
          <Link
            href={filterHref('all')}
            className={`gantry-toolbar-btn gantry-toolbar-btn-muted${
              category === 'all' ? ' is-active' : ''
            }`}
            aria-current={category === 'all' ? 'true' : undefined}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={filterHref(cat)}
              className={`gantry-toolbar-btn gantry-toolbar-btn-muted${
                category === cat ? ' is-active' : ''
              }`}
              aria-current={category === cat ? 'true' : undefined}
            >
              {cat}
            </Link>
          ))}
        </div>
      </section>

      <Feedback state={updateState} />
      <Feedback state={toggleState} />
      <Feedback state={deleteState} />

      <section
        className="outlines-create"
        aria-label={`Rules list${category !== 'all' ? ` — ${category}` : ''}`}
      >
        <h3>Rules</h3>
        <div className="outlines-table-wrap admin-settings-panel-wide">
          <table className="outlines-table">
            <thead>
              <tr>
                <th scope="col">Label</th>
                <th scope="col">Module</th>
                <th scope="col">Trigger</th>
                <th scope="col">Mode</th>
                <th scope="col">Template</th>
                <th scope="col">Updated</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-empty">
                    No rules yet. Use Add + or Seed Forms notify rules.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr
                    key={rule.id}
                    className={editingId === rule.id ? 'is-editing' : undefined}
                  >
                    <td>
                      <strong>{rule.label}</strong>
                      {!rule.enabled ? <span className="field-hint"> (off)</span> : null}
                    </td>
                    <td>{rule.moduleCategory}</td>
                    <td>
                      <code>{rule.triggerKey}</code>
                    </td>
                    <td>{rule.mode}</td>
                    <td>
                      <code>{rule.templateId}</code>
                    </td>
                    <td>{formatUpdated(rule.updatedAt)}</td>
                    <td>
                      <div className="admin-action-row sf-events-list-row-actions">
                        <button
                          type="button"
                          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                          disabled={busy}
                          onClick={() => {
                            setCreateOpen(false)
                            setEditingId((id) => (id === rule.id ? null : rule.id))
                          }}
                        >
                          {editingId === rule.id ? 'Close' : 'Edit'}
                        </button>
                        <form action={toggleAction}>
                          <input type="hidden" name="id" value={rule.id} />
                          <input
                            type="hidden"
                            name="enabled"
                            value={rule.enabled ? '0' : '1'}
                          />
                          <button
                            type="submit"
                            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                            disabled={busy}
                          >
                            {rule.enabled ? 'Disable' : 'Enable'}
                          </button>
                        </form>
                        <button
                          type="button"
                          className="gantry-toolbar-btn gantry-toolbar-btn-danger"
                          disabled={busy}
                          onClick={() => setDeleteTarget(rule)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing ? (
        <section
          className="outlines-create sf-events-inline-editor"
          aria-label={`Edit rule ${editing.label}`}
        >
          <h3>Edit · {editing.label}</h3>
          <form
            key={`${editing.id}-${editing.updatedAt}`}
            id={`email-rule-edit-${editing.id}`}
            action={updateAction}
          >
            <input type="hidden" name="id" value={editing.id} />
            <RuleEditFields
              rule={editing}
              categories={categories}
              templates={templates}
              triggers={triggers}
              busy={busy}
            />
          </form>
          <Feedback state={updateState} />
          <div className="admin-action-row sf-events-form-actions">
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              onClick={() => setEditingId(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form={`email-rule-edit-${editing.id}`}
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={busy}
            >
              {updatePending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </section>
      ) : null}

      <AdminConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete rule"
        message={
          deleteTarget ? `Delete rule “${deleteTarget.label}”? This cannot be undone.` : ''
        }
        confirmLabel={deletePending ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget || deletePending) return
          const id = deleteTarget.id
          setDeleteTarget(null)
          const data = new FormData()
          data.set('id', id)
          void deleteAction(data)
        }}
      />
    </div>
  )
}

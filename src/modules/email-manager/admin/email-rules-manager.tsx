'use client'

import React, { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/app/admin/admin-toast'

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
    return d.toLocaleString()
  } catch {
    return '—'
  }
}

export function EmailRulesManager({
  category,
  categories,
  rules,
  templates,
  triggers,
}: Props) {
  const router = useRouter()
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
    if (
      createState.ok ||
      updateState.ok ||
      toggleState.ok ||
      deleteState.ok ||
      seedState.ok
    ) {
      router.refresh()
    }
  }, [createState, updateState, toggleState, deleteState, seedState, router])

  const busy =
    createPending || updatePending || togglePending || deletePending || seedPending

  return (
    <div className="sf-email-rules-manager admin-settings-mosaic">
      <section className="outlines-create" aria-label="Filter rules">
        <h3>Filter by module</h3>
        <p className="field-hint">
          Category tags help find Forms / Auth / Events rules as more packs emit triggers.
        </p>
        <div className="admin-inline-actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <Link
            href="/app/admin/email"
            className={
              category === 'all' ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
            }
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/app/admin/email?category=${encodeURIComponent(cat)}`}
              className={
                category === cat ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
              }
            >
              {cat}
            </Link>
          ))}
        </div>
      </section>

      <section className="outlines-create" aria-label="Forms starters">
        <h3>Forms starters</h3>
        <p className="field-hint">
          Creates conditional admin + respondent rules on <code>product:forms/submitted</code>{' '}
          (payload paths <code>adminEmails</code> / <code>respondentEmail</code>). Safe to
          re-run.
        </p>
        <form action={seedAction}>
          <button type="submit" className="gantry-btn gantry-btn-primary" disabled={busy}>
            {seedPending ? 'Seeding…' : 'Seed Forms notify rules'}
          </button>
        </form>
        <Feedback state={seedState} />
      </section>

      <section className="outlines-create" aria-label="Create rule">
        <h3>Add rule</h3>
        <form action={createAction} className="outlines-create-form admin-create-form">
          <label className="settings-field">
            <span>Label</span>
            <input type="text" name="label" required maxLength={200} autoComplete="off" />
          </label>
          <label className="settings-field">
            <span>Module category</span>
            <select name="moduleCategory" defaultValue={category === 'all' ? 'forms' : category}>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>Trigger</span>
            <select name="triggerKey" required defaultValue="product:forms/submitted">
              {triggers.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label} ({t.key})
                </option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>Mode</span>
            <select name="mode" defaultValue="conditional">
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
            />
          </label>
          <label className="settings-field">
            <span>Condition op</span>
            <select name="conditionOp" defaultValue="truthy">
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
            <input type="text" name="conditionValue" autoComplete="off" />
          </label>
          <label className="settings-field">
            <span>To (literal emails)</span>
            <input
              type="text"
              name="audienceTo"
              placeholder="admin@example.com"
              autoComplete="off"
            />
          </label>
          <label className="settings-field">
            <span>To from payload paths</span>
            <input
              type="text"
              name="audienceToFromPayload"
              placeholder="adminEmails, respondentEmail"
              autoComplete="off"
            />
          </label>
          <label className="settings-field">
            <span>Template</span>
            <select name="templateId" required disabled={templates.length === 0}>
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
            <input type="text" name="fromOverride" placeholder="noreply@…" autoComplete="off" />
          </label>
          <label className="settings-field settings-field-check">
            <span>
              <input type="checkbox" name="enabled" value="1" defaultChecked /> Enabled
            </span>
          </label>
          <button
            type="submit"
            className="gantry-btn gantry-btn-primary"
            disabled={busy || templates.length === 0}
          >
            {createPending ? 'Creating…' : 'Add rule'}
          </button>
        </form>
        <Feedback state={createState} />
      </section>

      <Feedback state={updateState} />
      <Feedback state={toggleState} />
      <Feedback state={deleteState} />

      <div
        className="outlines-table-wrap admin-settings-panel-wide"
        aria-label={`Rules list${category !== 'all' ? ` — ${category}` : ''}`}
      >
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
                  No rules yet. Seed Forms starters or add a rule above.
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <strong>{rule.label}</strong>
                    {!rule.enabled ? (
                      <span className="field-hint"> (off)</span>
                    ) : null}
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
                    <details>
                      <summary>Edit</summary>
                      <form action={updateAction} className="admin-create-form">
                        <input type="hidden" name="id" value={rule.id} />
                        <label className="settings-field">
                          <span>Label</span>
                          <input
                            type="text"
                            name="label"
                            defaultValue={rule.label}
                            required
                            maxLength={200}
                          />
                        </label>
                        <label className="settings-field">
                          <span>Module category</span>
                          <select
                            name="moduleCategory"
                            defaultValue={rule.moduleCategory}
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
                          <select name="triggerKey" defaultValue={rule.triggerKey}>
                            {triggers.map((t) => (
                              <option key={t.key} value={t.key}>
                                {t.label} ({t.key})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="settings-field">
                          <span>Mode</span>
                          <select name="mode" defaultValue={rule.mode}>
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
                          />
                        </label>
                        <label className="settings-field">
                          <span>To</span>
                          <input
                            type="text"
                            name="audienceTo"
                            defaultValue={rule.audienceTo}
                          />
                        </label>
                        <label className="settings-field">
                          <span>To from payload</span>
                          <input
                            type="text"
                            name="audienceToFromPayload"
                            defaultValue={rule.audienceToFromPayload}
                          />
                        </label>
                        <label className="settings-field">
                          <span>Reply-To</span>
                          <input
                            type="text"
                            name="audienceReplyTo"
                            defaultValue={rule.audienceReplyTo}
                          />
                        </label>
                        <label className="settings-field">
                          <span>Template</span>
                          <select name="templateId" defaultValue={rule.templateId}>
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
                          />
                        </label>
                        <label className="settings-field settings-field-check">
                          <span>
                            <input
                              type="checkbox"
                              name="enabled"
                              value="1"
                              defaultChecked={rule.enabled}
                            />{' '}
                            Enabled
                          </span>
                        </label>
                        <button
                          type="submit"
                          className="gantry-btn gantry-btn-primary"
                          disabled={busy}
                        >
                          Save
                        </button>
                      </form>
                      <form action={toggleAction} style={{ marginTop: '0.5rem' }}>
                        <input type="hidden" name="id" value={rule.id} />
                        <input
                          type="hidden"
                          name="enabled"
                          value={rule.enabled ? '0' : '1'}
                        />
                        <button type="submit" className="gantry-btn" disabled={busy}>
                          {rule.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </form>
                      <form action={deleteAction} style={{ marginTop: '0.5rem' }}>
                        <input type="hidden" name="id" value={rule.id} />
                        <button
                          type="submit"
                          className="gantry-btn gantry-btn-danger"
                          disabled={busy}
                          onClick={(e) => {
                            if (!confirm(`Delete rule “${rule.label}”?`)) {
                              e.preventDefault()
                            }
                          }}
                        >
                          Delete
                        </button>
                      </form>
                    </details>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

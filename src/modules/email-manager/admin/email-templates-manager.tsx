'use client'

import React, { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { MediaPicker } from '@/modules/media/api'
import { RichEditor } from '@/modules/rich-editor/api'

import {
  createEmailTemplateAction,
  deleteEmailTemplateAction,
  testEmailSendAction,
  updateEmailTemplateAction,
  type EmailAdminActionState,
} from '../actions'

type TemplateRow = {
  id: string
  label: string
  moduleCategory: string
  subject: string
  bodyText: string
  bodyHtml: string
  updatedAt: string
}

type Props = {
  category: string
  categories: string[]
  templates: TemplateRow[]
  mailerEnabled: boolean
  mailerLabel: string
  /** product:rich-editor gate — Email Manager requires it for HTML bodies. */
  richEditorEnabled: boolean
}

function EmailBodyHtmlField({
  defaultValue = '',
  disabled,
  richEditorEnabled,
}: {
  defaultValue?: string
  disabled?: boolean
  richEditorEnabled: boolean
}) {
  if (!richEditorEnabled) {
    return (
      <div className="settings-field settings-field-wide">
        <span>Body (HTML, optional)</span>
        <p className="admin-inline-error" role="alert">
          Rich editor is required for HTML email bodies. Enable it under{' '}
          <Link href="/admin/rich-editor/settings">Site Settings → Modules → Rich editor</Link>.
        </p>
        {/* Preserve existing HTML on save until rich-editor is enabled again. */}
        <input type="hidden" name="bodyHtml" value={defaultValue} readOnly />
      </div>
    )
  }

  return (
    <div className="settings-field settings-field-wide">
      <RichEditor
        name="bodyHtml"
        label="Body (HTML, optional)"
        defaultValue={defaultValue}
        disabled={disabled}
        enabled
        preset="email"
        placeholder="Optional email-safe HTML body…"
        MediaPicker={MediaPicker}
      />
      <p className="settings-hint">
        Email-safe TipTap (lists, links, images). No video, gallery, or web-only blocks.
      </p>
    </div>
  )
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

export function EmailTemplatesManager({
  category,
  categories,
  templates,
  mailerEnabled,
  mailerLabel,
  richEditorEnabled,
}: Props) {
  const router = useRouter()
  const [createState, createAction, createPending] = useActionState(
    createEmailTemplateAction,
    initial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateEmailTemplateAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteEmailTemplateAction,
    initial,
  )
  const [testState, testAction, testPending] = useActionState(testEmailSendAction, initial)

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(deleteState)
  useNotifySavedOnOk(testState)

  useEffect(() => {
    if (createState.ok || updateState.ok || deleteState.ok) {
      router.refresh()
    }
  }, [createState, updateState, deleteState, router])

  const busy = createPending || updatePending || deletePending || testPending

  return (
    <div className="sf-email-templates-manager admin-settings-mosaic">
      <section
        className="outlines-create admin-settings-panel-wide"
        aria-label="Filter templates"
      >
        <h3>Filter by module</h3>
        <p className="field-hint">
          Module tags keep Forms / Auth / Events templates findable as packs grow.
        </p>
        <div className="admin-inline-actions">
          <Link
            href="/admin/email/templates"
            className={
              category === 'all' ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
            }
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/admin/email/templates?category=${encodeURIComponent(cat)}`}
              className={
                category === cat ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
              }
            >
              {cat}
            </Link>
          ))}
        </div>
      </section>

      <section className="outlines-create sf-email-templates-card" aria-label="Test send">
        <h3>Test send</h3>
        <p className="field-hint">
          Uses platform Mailer ({mailerLabel}
          {!mailerEnabled ? ' — disabled in Chrome' : ''}). Console provider logs only; SMTP /
          Resend soft-fail when secrets are missing.
        </p>
        <form
          action={testAction}
          className="outlines-create-form admin-create-form sf-email-templates-card-form"
        >
          <label className="settings-field">
            <span>To</span>
            <input type="email" name="to" required autoComplete="off" />
          </label>
          <label className="settings-field">
            <span>Subject</span>
            <input
              type="text"
              name="subject"
              defaultValue="Starforge Email Manager test"
              maxLength={500}
            />
          </label>
          <label className="settings-field">
            <span>Body</span>
            <textarea
              name="text"
              rows={3}
              defaultValue="Test message from Email Manager."
            />
          </label>
          <button type="submit" className="gantry-btn gantry-btn-primary" disabled={busy}>
            {testPending ? 'Sending…' : 'Send test'}
          </button>
        </form>
        <Feedback state={testState} />
      </section>

      <section className="outlines-create sf-email-templates-card" aria-label="Create template">
        <h3>Add template</h3>
        <form
          action={createAction}
          className="outlines-create-form admin-create-form sf-email-templates-card-form"
        >
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
            <span>Subject</span>
            <input
              type="text"
              name="subject"
              required
              maxLength={500}
              placeholder="[Site] {{formTitle}}"
              autoComplete="off"
            />
          </label>
          <label className="settings-field">
            <span>Body (text)</span>
            <textarea
              name="bodyText"
              rows={5}
              placeholder={'Form: {{formTitle}}\n\n{{payloadText}}'}
              required
            />
          </label>
          <EmailBodyHtmlField disabled={busy} richEditorEnabled={richEditorEnabled} />
          <button type="submit" className="gantry-btn gantry-btn-primary" disabled={busy}>
            {createPending ? 'Creating…' : 'Add template'}
          </button>
        </form>
        <Feedback state={createState} />
      </section>

      <Feedback state={updateState} />
      <Feedback state={deleteState} />

      <div
        className="outlines-table-wrap admin-settings-panel-wide"
        aria-label={`Templates list${category !== 'all' ? ` — ${category}` : ''}`}
      >
        <table className="outlines-table">
          <thead>
            <tr>
              <th scope="col">Label</th>
              <th scope="col">Module</th>
              <th scope="col">Subject</th>
              <th scope="col">Updated</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-empty">
                  No templates yet. Add one above, or seed Forms starters from{' '}
                  <Link href="/admin/email">Rules</Link>.
                </td>
              </tr>
            ) : (
              templates.map((tpl) => (
                <tr key={tpl.id}>
                  <td>
                    <strong>{tpl.label}</strong>
                  </td>
                  <td>{tpl.moduleCategory}</td>
                  <td>{tpl.subject}</td>
                  <td>{formatUpdated(tpl.updatedAt)}</td>
                  <td>
                    <details>
                      <summary>Edit</summary>
                      <form action={updateAction} className="admin-create-form">
                        <input type="hidden" name="id" value={tpl.id} />
                        <label className="settings-field">
                          <span>Label</span>
                          <input
                            type="text"
                            name="label"
                            defaultValue={tpl.label}
                            required
                            maxLength={200}
                          />
                        </label>
                        <label className="settings-field">
                          <span>Module category</span>
                          <select
                            name="moduleCategory"
                            defaultValue={tpl.moduleCategory}
                          >
                            {categories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="settings-field">
                          <span>Subject</span>
                          <input
                            type="text"
                            name="subject"
                            defaultValue={tpl.subject}
                            required
                            maxLength={500}
                          />
                        </label>
                        <label className="settings-field">
                          <span>Body (text)</span>
                          <textarea
                            name="bodyText"
                            rows={5}
                            defaultValue={tpl.bodyText}
                            required
                          />
                        </label>
                        <EmailBodyHtmlField
                          defaultValue={tpl.bodyHtml}
                          disabled={busy}
                          richEditorEnabled={richEditorEnabled}
                        />
                        <button
                          type="submit"
                          className="gantry-btn gantry-btn-primary"
                          disabled={busy}
                        >
                          Save
                        </button>
                      </form>
                      <form action={deleteAction} style={{ marginTop: '0.5rem' }}>
                        <input type="hidden" name="id" value={tpl.id} />
                        <button
                          type="submit"
                          className="gantry-btn gantry-btn-danger"
                          disabled={busy}
                          onClick={(e) => {
                            if (!confirm(`Delete template “${tpl.label}”?`)) {
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

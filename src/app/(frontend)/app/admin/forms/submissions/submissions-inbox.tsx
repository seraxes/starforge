'use client'

import React, { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  deleteFormSubmissionAction,
  resendFormSubmissionNotifyAction,
  type FormAdminActionState,
} from '@/core/forms/actions'
import type { FormPresetId, FormSubmissionPayload } from '@/core/forms/types'

import { useNotifySavedOnOk } from '../../admin-toast'

function payloadCellText(value: FormSubmissionPayload[string] | undefined): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(String).join(', ')
  return String(value)
}

export type SubmissionRow = {
  id: string
  formKey: string
  definitionId: string | null
  payload: FormSubmissionPayload
  ipAddress: string | null
  createdAt: string
}

export type DefinitionOption = {
  id: string
  label: string
  preset: FormPresetId
}

type Props = {
  submissions: SubmissionRow[]
  definitions: DefinitionOption[]
  filterDefinitionId: string
}

const initial: FormAdminActionState = {}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function payloadSummary(payload: FormSubmissionPayload): string {
  const name = payloadCellText(payload.name).trim()
  const email = payloadCellText(payload.email).trim()
  const message =
    payloadCellText(payload.message).trim() ||
    payloadCellText(payload.notes).trim() ||
    payloadCellText(payload.subject).trim() ||
    payloadCellText(payload.details).trim()
  const parts = [name, email].filter(Boolean)
  if (parts.length === 0 && message) return message.slice(0, 80)
  if (message) return `${parts.join(' · ')} — ${message.slice(0, 60)}`
  if (parts.length) return parts.join(' · ')
  const first = Object.entries(payload).find(([, v]) => payloadCellText(v).trim())
  return first ? `${first[0]}: ${payloadCellText(first[1]).slice(0, 80)}` : '(empty)'
}

function Feedback({ state }: { state: FormAdminActionState }) {
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

export function SubmissionsInbox({
  submissions,
  definitions,
  filterDefinitionId,
}: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteFormSubmissionAction,
    initial,
  )
  const [resendState, resendAction, resendPending] = useActionState(
    resendFormSubmissionNotifyAction,
    initial,
  )

  useNotifySavedOnOk(deleteState)
  useNotifySavedOnOk(resendState, { successMessage: 'Notify resent', toastErrors: true })

  useEffect(() => {
    if (deleteState.ok || resendState.ok) {
      setSelected(new Set())
      router.refresh()
    }
  }, [deleteState.ok, resendState.ok, router])

  const allIds = useMemo(() => submissions.map((s) => s.id), [submissions])
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(allIds))
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exportHref = filterDefinitionId
    ? `/api/admin/forms/export?definitionId=${encodeURIComponent(filterDefinitionId)}${
        selected.size
          ? `&ids=${encodeURIComponent([...selected].join(','))}`
          : ''
      }`
    : selected.size === 1
      ? (() => {
          const row = submissions.find((s) => selected.has(s.id))
          return row?.definitionId
            ? `/api/admin/forms/export?definitionId=${encodeURIComponent(row.definitionId)}&ids=${encodeURIComponent(row.id)}`
            : null
        })()
      : null

  return (
    <div className="sf-forms-submissions-inbox">
      <form method="get" className="admin-create-form sf-forms-submissions-filter" action="">
        <label className="settings-field">
          <span>Form definition</span>
          <select
            name="definitionId"
            defaultValue={filterDefinitionId}
            onChange={(e) => {
              const v = e.target.value
              router.push(
                v
                  ? `/app/admin/forms/submissions?definitionId=${encodeURIComponent(v)}`
                  : '/app/admin/forms/submissions',
              )
            }}
          >
            <option value="">All recent (last 100)</option>
            {definitions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label} ({d.id})
              </option>
            ))}
          </select>
        </label>
        <div className="sf-forms-submissions-filter-actions">
          {filterDefinitionId ? (
            <a
              href={`/api/admin/forms/export?definitionId=${encodeURIComponent(filterDefinitionId)}`}
              className="gantry-toolbar-btn secondary"
            >
              Export CSV (filtered)
            </a>
          ) : null}
          {exportHref && selected.size > 0 ? (
            <a href={exportHref} className="gantry-toolbar-btn secondary">
              Export selected ({selected.size})
            </a>
          ) : null}
        </div>
      </form>

      <Feedback state={deleteState} />
      <Feedback state={resendState} />

      {submissions.length === 0 ? (
        <p className="admin-empty">No submissions yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table sf-forms-table">
            <thead>
              <tr>
                <th scope="col">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all submissions"
                  />
                </th>
                <th scope="col">When</th>
                <th scope="col">Form</th>
                <th scope="col">Definition</th>
                <th scope="col">Summary</th>
                <th scope="col">IP</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`Select submission ${row.id}`}
                    />
                  </td>
                  <td>
                    <time dateTime={row.createdAt}>{formatWhen(row.createdAt)}</time>
                  </td>
                  <td>
                    <code className="sf-forms-key">{row.formKey}</code>
                  </td>
                  <td>
                    {row.definitionId ? (
                      <Link href={`/app/admin/forms/${row.definitionId}`}>
                        <code>{row.definitionId}</code>
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <details className="sf-forms-details">
                      <summary>{payloadSummary(row.payload)}</summary>
                      <dl className="sf-forms-payload">
                        {Object.entries(row.payload).map(([k, v]) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>
                              {(() => {
                                const text = payloadCellText(v).trim()
                                if (
                                  text &&
                                  /^\d+$/.test(text) &&
                                  /file|attach|upload|document|resume|photo|image/i.test(k)
                                ) {
                                  return (
                                    <a href={`/api/admin/form-attachments/${text}`}>
                                      Attachment #{text}
                                    </a>
                                  )
                                }
                                return text || '—'
                              })()}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  </td>
                  <td>{row.ipAddress || '—'}</td>
                  <td className="outlines-actions">
                    {row.definitionId ? (
                      <form action={resendAction} className="outlines-inline-form">
                        <input type="hidden" name="submissionId" value={row.id} />
                        <button
                          type="submit"
                          className="gantry-toolbar-btn secondary"
                          disabled={resendPending}
                        >
                          Resend notify
                        </button>
                      </form>
                    ) : null}
                    <form action={deleteAction} className="outlines-inline-form">
                      <input type="hidden" name="submissionId" value={row.id} />
                      <button
                        type="submit"
                        className="gantry-toolbar-btn danger"
                        disabled={deletePending}
                        onClick={(e) => {
                          if (!confirm('Delete this submission?')) e.preventDefault()
                        }}
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

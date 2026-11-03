import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { listFormSubmissions } from '@/core/forms'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { FormsAdminNav } from '../forms-admin-nav'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Form submissions — Starforge',
  description: 'Inbox for public Form particle submissions.',
}

function formatWhen(d: Date): string {
  try {
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return d.toISOString()
  }
}

function payloadValueText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.map((item) => String(item ?? '')).join(', ')
  return String(v)
}

function payloadSummary(payload: Record<string, unknown>): string {
  const name = payloadValueText(payload.name).trim()
  const email = payloadValueText(payload.email).trim()
  const message =
    payloadValueText(payload.message).trim() ||
    payloadValueText(payload.notes).trim() ||
    payloadValueText(payload.subject).trim()
  const parts = [name, email].filter(Boolean)
  if (parts.length === 0 && message) return message.slice(0, 80)
  if (message) return `${parts.join(' · ')} — ${message.slice(0, 60)}`
  if (parts.length) return parts.join(' · ')
  const first = Object.entries(payload).find(([, v]) => payloadValueText(v).trim())
  return first ? `${first[0]}: ${payloadValueText(first[1]).slice(0, 80)}` : '(empty)'
}

export default async function AdminFormSubmissionsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    redirect('/app/admin/settings')
  }

  const submissions = await listFormSubmissions({ limit: 100 })

  return (
    <section className="admin-section admin-layouts-full">
      <FormsAdminNav active="forms" />
      <h2>Submissions</h2>
      <p className="lede admin-lede">
        Deep-link inbox only (Submissions is not in Core/Payload nav or Forms tabs). Reach here from{' '}
        <Link href="/app/admin/forms/settings">Forms → Settings</Link>. Definitions live under{' '}
        <Link href="/app/admin/forms">Forms</Link>. File fields store private Payload Media ids
        (open via <code>/api/admin/form-attachments/&lt;id&gt;</code>, admins only).
      </p>

      {submissions.length === 0 ? (
        <p className="admin-empty">No submissions yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table sf-forms-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Form</th>
                <th scope="col">Definition</th>
                <th scope="col">Summary</th>
                <th scope="col">IP</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((row) => (
                <tr key={row.id}>
                  <td>
                    <time dateTime={row.createdAt.toISOString()}>{formatWhen(row.createdAt)}</time>
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
                        {Object.entries(row.payload).map(([k, v]) => {
                          const text = payloadValueText(v)
                          const isFileId =
                            Boolean(text) &&
                            /^\d+$/.test(text.trim()) &&
                            /file|attach|upload|document|resume|photo|image/i.test(k)
                          return (
                            <div key={k}>
                              <dt>{k}</dt>
                              <dd>
                                {isFileId ? (
                                  <a href={`/api/admin/form-attachments/${text.trim()}`}>
                                    Attachment #{text.trim()}
                                  </a>
                                ) : (
                                  text || '—'
                                )}
                              </dd>
                            </div>
                          )
                        })}
                      </dl>
                    </details>
                  </td>
                  <td>{row.ipAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

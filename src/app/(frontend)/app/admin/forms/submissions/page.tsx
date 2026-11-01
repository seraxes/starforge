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

function payloadSummary(payload: Record<string, string>): string {
  const name = payload.name?.trim()
  const email = payload.email?.trim()
  const message = payload.message?.trim() || payload.notes?.trim() || payload.subject?.trim()
  const parts = [name, email].filter(Boolean)
  if (parts.length === 0 && message) return message.slice(0, 80)
  if (message) return `${parts.join(' · ')} — ${message.slice(0, 60)}`
  if (parts.length) return parts.join(' · ')
  const first = Object.entries(payload).find(([, v]) => v.trim())
  return first ? `${first[0]}: ${first[1].slice(0, 80)}` : '(empty)'
}

export default async function AdminFormSubmissionsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    redirect('/app/admin/settings')
  }

  const submissions = await listFormSubmissions({ limit: 100 })

  return (
    <section className="admin-section admin-layouts-full">
      <FormsAdminNav active="submissions" />
      <h2>Submissions</h2>
      <p className="lede admin-lede">
        Public Form particle submissions. Definitions live under{' '}
        <Link href="/app/admin/forms">Forms</Link>.
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
                        {Object.entries(row.payload).map(([k, v]) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>{v || '—'}</dd>
                          </div>
                        ))}
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

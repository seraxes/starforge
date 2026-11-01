import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  ensureDefaultContactFormSeeded,
  listFormDefinitions,
  listFormSubmissions,
} from '@/core/forms'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { FormsManager } from './forms-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Forms — Starforge',
  description: 'Modular Form engine — definitions, builder, and submissions.',
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

export default async function AdminFormsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    redirect('/app/admin/settings')
  }

  await ensureDefaultContactFormSeeded()
  const [definitions, submissions] = await Promise.all([
    listFormDefinitions(),
    listFormSubmissions({ limit: 100 }),
  ])

  return (
    <section className="admin-section admin-layouts-full">
      <h2>Forms</h2>
      <p className="lede admin-lede">
        Modular Form engine (SF-65): visual builder → JSON Schema / Zod. Place the{' '}
        <strong>Form</strong> particle under <Link href="/app/admin/layouts">Layouts</Link> and
        bind a definition. Captcha defaults in{' '}
        <Link href="/app/admin/site-chrome">Site Chrome</Link>. Toggle under{' '}
        <Link href="/app/admin/settings">Site Settings</Link>. Storage:{' '}
        <code>sf_forms</code> + <code>sf_form_submissions</code>.
      </p>

      <h3>Definitions</h3>
      <FormsManager
        forms={definitions.map((d) => ({
          id: d.id,
          label: d.label,
          preset: d.preset,
          fieldCount: d.fieldCount,
          updatedAt: d.updatedAt.toISOString(),
        }))}
      />

      <h3 className="sf-forms-submissions-heading">Submissions</h3>
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
                    <time dateTime={row.createdAt.toISOString()}>
                      {formatWhen(row.createdAt)}
                    </time>
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

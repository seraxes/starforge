import React from 'react'
import Link from 'next/link'

import type { DocumentLinkRecord } from '../links'
import type { DocumentSubjectKind } from '../links-rules'

type Props = {
  subjectKind: DocumentSubjectKind
  subjectId: string
  links: DocumentLinkRecord[]
}

/** Subject file list when staff open /admin/documents for one subject. */
export function DocumentsSubjectLinksPanel({ subjectKind, subjectId, links }: Props) {
  return (
    <section className="page-settings-panel" style={{ marginBottom: '1.25rem' }}>
      <header className="page-settings-panel-head">
        <h3>Subject links</h3>
      </header>
      <div className="page-settings-panel-body">
        <p className="settings-hint">
          Kind <code>{subjectKind}</code> · id <code>{subjectId}</code>. Media keeps the file bytes;
          this pack stores the link. Valid-until stays on Onboarding slots when the subject is a
          person.
          {subjectKind === 'onboarding' ? (
            <>
              {' '}
              <Link href={`/admin/onboarding/people/${encodeURIComponent(subjectId)}`}>
                Open person card
              </Link>
              .
            </>
          ) : null}
        </p>
        {links.length === 0 ? (
          <p className="layout-muted">No bound or rendered files for this subject yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Template</th>
                <th scope="col">Media id</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td>{link.title || '—'}</td>
                  <td>{link.templateId || '—'}</td>
                  <td>
                    <code>{link.mediaId}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

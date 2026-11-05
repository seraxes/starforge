import React from 'react'
import Link from 'next/link'

export type DashboardSoftPlaceholderStatus =
  | 'coming-soon'
  | 'unavailable'
  | 'module-disabled'
  | 'soft-fail'

const STATUS_COPY: Record<DashboardSoftPlaceholderStatus, string> = {
  'coming-soon': 'Coming soon',
  unavailable: 'Unavailable',
  'module-disabled': 'Module disabled',
  'soft-fail': '—',
}

/**
 * Compact Dashboard card body for unwired / disabled / soft-fail states.
 * Intentional copy — not empty padded junk boxes.
 */
export function DashboardSoftPlaceholder(props: {
  status: DashboardSoftPlaceholderStatus
  /** Optional one-line hint under the status. */
  hint?: string
  /** Metric rows shown as labels with “—” values (Media kinds, Email types, …). */
  rows?: ReadonlyArray<{ label: string; value?: string }>
  footerHref?: string
  footerLabel?: string
}) {
  const { status, hint, rows, footerHref, footerLabel } = props
  const statusText = STATUS_COPY[status]

  return (
    <div className="sf-dashboard-placeholder" data-status={status}>
      <p className="sf-dashboard-placeholder-status" aria-live="polite">
        {statusText}
      </p>
      {hint ? <p className="sf-dashboard-placeholder-hint">{hint}</p> : null}
      {rows && rows.length > 0 ? (
        <dl className="sf-dashboard-placeholder-rows">
          {rows.map((row) => (
            <div key={row.label} className="sf-dashboard-placeholder-row">
              <dt>{row.label}</dt>
              <dd>{row.value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {footerHref && footerLabel ? (
        <p className="sf-dashboard-card-foot">
          <Link href={footerHref}>{footerLabel}</Link>
        </p>
      ) : null}
    </div>
  )
}

export default DashboardSoftPlaceholder

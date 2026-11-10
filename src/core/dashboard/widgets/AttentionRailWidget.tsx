import React from 'react'
import Link from 'next/link'

import { loadAttentionRailStats } from './attention-stats'
import type { AttentionSeverity } from './attention'

function severityClass(severity: AttentionSeverity): string {
  return severity === 'critical'
    ? 'sf-dashboard-chip sf-dashboard-chip-fail'
    : 'sf-dashboard-chip sf-dashboard-chip-warn'
}

function severityLabel(severity: AttentionSeverity): string {
  return severity === 'critical' ? 'Critical' : 'Warning'
}

/**
 * Core Dashboard rail — offline, Mailer off, health, env warnings.
 * Env rows are included only for developer-admins.
 */
export async function AttentionRailWidget() {
  const result = await loadAttentionRailStats()
  const items = result.ok ? result.data.items : []

  if (!result.ok) {
    return <p className="sf-dashboard-soft-fail">—</p>
  }

  if (items.length === 0) {
    return <p className="sf-dashboard-attention-clear">Nothing needs attention.</p>
  }

  return (
    <ul className="sf-dashboard-attention" aria-label="Needs attention">
      {items.map((item) => (
        <li key={item.id} className="sf-dashboard-attention-item" data-severity={item.severity}>
          <span className={severityClass(item.severity)}>{severityLabel(item.severity)}</span>
          <Link href={item.href}>{item.label}</Link>
        </li>
      ))}
    </ul>
  )
}

export default AttentionRailWidget

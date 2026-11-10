/**
 * Needs-attention rail. Core seeds only: site offline, Mailer off,
 * health, and environment warnings. Env rows are omitted unless the
 * caller already decided the viewer is a developer-admin.
 */

import { coreAdminPath } from '@/core/admin-paths'

export type AttentionSeverity = 'critical' | 'warning'

export type AttentionItem = {
  id: string
  severity: AttentionSeverity
  label: string
  href: string
}

export type EnvAttentionIssue = {
  key: string
  message: string
}

const ENV_WARNING_LIMIT = 4

const CHROME_HREF = coreAdminPath('/site-chrome')
const ENVIRONMENT_HREF = coreAdminPath('/site-chrome/environment')

/** Drop messages that might carry a URL or secret. Key name only. */
const SECRETISH =
  /(?:postgres(?:ql)?:\/\/|redis(?:s)?:\/\/|https?:\/\/\S+|password\s*=|secret\s*=|[A-Za-z0-9+/]{32,}={0,2})/i

export function safeEnvAttentionLabel(issue: EnvAttentionIssue): string {
  const key = issue.key.trim() || 'Environment'
  const message = issue.message.trim()
  if (!message || SECRETISH.test(message)) return `${key} needs a look`
  return message
}

export function visibleEnvWarnings(
  isDeveloperAdmin: boolean,
  warnings: readonly EnvAttentionIssue[],
): EnvAttentionIssue[] | null {
  if (!isDeveloperAdmin) return null
  return warnings.slice()
}

export function buildCoreAttentionItems(input: {
  siteOffline: boolean | null
  mailerEnabled: boolean | null
  healthLevel: 'ok' | 'warn' | 'fail' | null
  envWarnings: readonly EnvAttentionIssue[] | null
}): AttentionItem[] {
  const items: AttentionItem[] = []

  if (input.siteOffline === true) {
    items.push({
      id: 'site.offline',
      severity: 'critical',
      label: 'Site is offline',
      href: CHROME_HREF,
    })
  }

  if (input.mailerEnabled === false) {
    items.push({
      id: 'mailer.off',
      severity: 'warning',
      label: 'Outbound email is off',
      href: CHROME_HREF,
    })
  }

  if (input.healthLevel === 'fail') {
    items.push({
      id: 'health.fail',
      severity: 'critical',
      label: 'System health failed',
      href: ENVIRONMENT_HREF,
    })
  } else if (input.healthLevel === 'warn') {
    items.push({
      id: 'health.warn',
      severity: 'warning',
      label: 'System health needs a look',
      href: ENVIRONMENT_HREF,
    })
  }

  const warnings = input.envWarnings
  if (warnings && warnings.length > 0) {
    const shown = warnings.slice(0, ENV_WARNING_LIMIT)
    for (const issue of shown) {
      const key = issue.key.trim() || 'env'
      items.push({
        id: `env.${key}`,
        severity: 'warning',
        label: safeEnvAttentionLabel(issue),
        href: ENVIRONMENT_HREF,
      })
    }
    const extra = warnings.length - shown.length
    if (extra > 0) {
      items.push({
        id: 'env.more',
        severity: 'warning',
        label: `${extra} more environment warning${extra === 1 ? '' : 's'}`,
        href: ENVIRONMENT_HREF,
      })
    }
  }

  const rank: Record<AttentionSeverity, number> = { critical: 0, warning: 1 }
  const family = (id: string) => {
    if (id.startsWith('health.')) return 0
    if (id.startsWith('site.')) return 1
    if (id.startsWith('mailer.')) return 2
    return 3
  }
  items.sort(
    (a, b) => rank[a.severity] - rank[b.severity] || family(a.id) - family(b.id) || a.id.localeCompare(b.id),
  )
  return items
}

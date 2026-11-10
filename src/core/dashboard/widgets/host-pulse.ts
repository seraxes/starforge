/**
 * Host pulse formatters for the Dashboard strip.
 * Stored bytes and this process — not a traffic counter.
 */

export type HostPulseStats = {
  uptimeLabel: string
  nodeLabel: string
  memoryLabel: string
  libraryLabel: string
  databaseLabel: string
}

export function formatProcessUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const s = Math.floor(seconds)
  if (s < 60) return `${s}s`
  const days = Math.floor(s / 86_400)
  const hours = Math.floor((s % 86_400) / 3_600)
  const minutes = Math.floor((s % 3_600) / 60)
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  return `${minutes}m`
}

export function formatNodeVersion(version: string): string {
  const trimmed = version.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`
}

/** Binary byte size. `null` is an unread probe, shown as an em dash. */
export function formatByteSize(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const text = unit === 0 ? String(Math.round(value)) : value >= 10 ? value.toFixed(0) : value.toFixed(1)
  return `${text} ${units[unit]}`
}

export function assembleHostPulse(input: {
  uptimeSec: number
  nodeVersion: string
  memoryBytes: number
  libraryBytes: number | null
  databaseBytes: number | null
}): HostPulseStats {
  return {
    uptimeLabel: formatProcessUptime(input.uptimeSec),
    nodeLabel: formatNodeVersion(input.nodeVersion),
    memoryLabel: formatByteSize(input.memoryBytes),
    libraryLabel: formatByteSize(input.libraryBytes),
    databaseLabel: formatByteSize(input.databaseBytes),
  }
}

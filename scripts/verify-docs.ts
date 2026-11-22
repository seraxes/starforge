/**
 * Docs hygiene checker (slice D5).
 *
 * Fails when frontmatter, superseded targets, scoped relative links, or rule
 * shape/size/date rules are wrong. Live docs older than 30 days warn only.
 *
 * Usage: npm run check:docs
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ALWAYS_APPLY_BUDGET_BYTES = 15 * 1024
const LIVE_STALE_DAYS = 30

export type DocsIssue = {
  level: 'error' | 'warning'
  code:
    | 'missing-frontmatter'
    | 'superseded-by-missing'
    | 'broken-link'
    | 'rule-globs-and-always-apply'
    | 'rule-missing-description'
    | 'always-apply-oversize'
    | 'rule-date'
    | 'live-stale'
  message: string
  file: string
}

export type DocsReport = {
  errors: DocsIssue[]
  warnings: DocsIssue[]
}

export type AuditDocsOptions = {
  root?: string
  /** Override "now" for live staleness checks (tests). */
  now?: Date
}

type Frontmatter = Record<string, string>

function toPosix(p: string): string {
  return p.replace(/\\/g, '/')
}

function relToRoot(root: string, abs: string): string {
  return toPosix(path.relative(root, abs))
}

async function pathExists(abs: string): Promise<boolean> {
  try {
    await stat(abs)
    return true
  } catch {
    return false
  }
}

async function walkFiles(dir: string, suffix: string): Promise<string[]> {
  const out: string[] = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(abs, suffix)))
      continue
    }
    if (entry.isFile() && entry.name.endsWith(suffix)) out.push(abs)
  }
  return out
}

function parseFrontmatter(raw: string): { fm: Frontmatter; body: string } | null {
  const normalized = raw.replace(/^\uFEFF/, '')
  if (!normalized.startsWith('---')) return null
  const end = normalized.indexOf('\n---', 3)
  if (end < 0) return null
  const block = normalized.slice(4, end).replace(/^\r?\n/, '')
  const bodyStart = end + '\n---'.length
  let body = normalized.slice(bodyStart)
  if (body.startsWith('\r\n')) body = body.slice(2)
  else if (body.startsWith('\n')) body = body.slice(1)

  const fm: Frontmatter = {}
  for (const line of block.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const colon = trimmed.indexOf(':')
    if (colon <= 0) continue
    const key = trimmed.slice(0, colon).trim()
    let value = trimmed.slice(colon + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    fm[key] = value
  }
  return { fm, body }
}

function extractMarkdownHrefs(text: string): string[] {
  const hrefs: string[] = []
  const re = /!?\[[^\]]*]\(([^)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    let href = match[1]!.trim()
    if (href.startsWith('<') && href.endsWith('>')) href = href.slice(1, -1).trim()
    const space = href.search(/\s/)
    if (space >= 0) href = href.slice(0, space).trim()
    const hash = href.indexOf('#')
    if (hash >= 0) href = href.slice(0, hash)
    if (href) hrefs.push(href)
  }
  return hrefs
}

function isRelativeFileHref(href: string): boolean {
  if (!href) return false
  if (/^(https?:|mailto:)/i.test(href)) return false
  if (href.startsWith('/')) return false
  return true
}

function shouldIgnoreHref(href: string): boolean {
  return href.includes('/cursor/stores/')
}

/** Strip Decision: markdown links so YYYY-MM-DD inside them is allowed. */
function bodyWithoutDecisionLinks(body: string): string {
  return body.replace(/Decision:\s*\[[^\]]*]\([^)]*\)/g, '')
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return null
  return d
}

async function checkFrontmatterAndSuperseded(
  root: string,
  errors: DocsIssue[],
  warnings: DocsIssue[],
  now: Date,
): Promise<void> {
  const scopes = [
    path.join(root, 'docs', 'project-context', 'docs'),
    path.join(root, 'docs', 'ops'),
  ]

  for (const scope of scopes) {
    const files = await walkFiles(scope, '.md')
    for (const abs of files) {
      const file = relToRoot(root, abs)
      if (toPosix(file).includes('/docs/archive/')) continue

      const raw = await readFile(abs, 'utf8')
      const parsed = parseFrontmatter(raw)
      const kind = parsed?.fm.kind?.trim()
      const lastVerified = parsed?.fm.last_verified?.trim()

      if (!parsed || !kind || !lastVerified) {
        errors.push({
          level: 'error',
          code: 'missing-frontmatter',
          message: 'missing kind and/or last_verified frontmatter',
          file,
        })
        continue
      }

      if (kind === 'superseded') {
        const target = parsed.fm.superseded_by?.trim()
        if (!target) {
          errors.push({
            level: 'error',
            code: 'superseded-by-missing',
            message: 'kind superseded requires superseded_by that resolves',
            file,
          })
        } else {
          const targetAbs = path.resolve(path.dirname(abs), target)
          if (!(await pathExists(targetAbs))) {
            errors.push({
              level: 'error',
              code: 'superseded-by-missing',
              message: `superseded_by target does not exist: ${target}`,
              file,
            })
          }
        }
      }

      if (kind === 'live') {
        const verified = parseIsoDate(lastVerified)
        if (verified) {
          const age = daysBetween(verified, now)
          if (age > LIVE_STALE_DAYS) {
            warnings.push({
              level: 'warning',
              code: 'live-stale',
              message: `kind live last_verified is ${age} days old (warn after ${LIVE_STALE_DAYS})`,
              file,
            })
          }
        }
      }
    }
  }
}

async function checkScopedLinks(root: string, errors: DocsIssue[]): Promise<void> {
  const targets: string[] = [
    path.join(root, 'docs', 'project-context', 'docs', 'architecture-current.md'),
    path.join(root, 'AGENTS.md'),
  ]
  targets.push(...(await walkFiles(path.join(root, '.cursor', 'rules'), '.mdc')))

  for (const abs of targets) {
    if (!(await pathExists(abs))) continue
    const file = relToRoot(root, abs)
    const raw = await readFile(abs, 'utf8')
    for (const href of extractMarkdownHrefs(raw)) {
      if (shouldIgnoreHref(href)) continue
      if (!isRelativeFileHref(href)) continue
      const targetAbs = path.resolve(path.dirname(abs), href)
      if (!(await pathExists(targetAbs))) {
        errors.push({
          level: 'error',
          code: 'broken-link',
          message: `broken relative link: ${href}`,
          file,
        })
      }
    }
  }
}

async function checkRules(
  root: string,
  errors: DocsIssue[],
): Promise<void> {
  const ruleFiles = await walkFiles(path.join(root, '.cursor', 'rules'), '.mdc')
  let alwaysApplyBytes = 0

  for (const abs of ruleFiles) {
    const file = relToRoot(root, abs)
    const buf = await readFile(abs)
    const raw = buf.toString('utf8')
    const parsed = parseFrontmatter(raw)
    if (!parsed) {
      errors.push({
        level: 'error',
        code: 'rule-missing-description',
        message: 'rule lacks frontmatter description',
        file,
      })
      continue
    }

    const { fm, body } = parsed
    const description = fm.description?.trim()
    if (!description) {
      errors.push({
        level: 'error',
        code: 'rule-missing-description',
        message: 'rule lacks a description',
        file,
      })
    }

    const alwaysApply = fm.alwaysApply === 'true'
    const hasGlobs = Object.prototype.hasOwnProperty.call(fm, 'globs') && Boolean(fm.globs?.trim())

    if (alwaysApply && hasGlobs) {
      errors.push({
        level: 'error',
        code: 'rule-globs-and-always-apply',
        message: 'rule has both globs and alwaysApply: true',
        file,
      })
    }

    if (alwaysApply) alwaysApplyBytes += buf.byteLength

    const scrubbed = bodyWithoutDecisionLinks(body)
    const dateMatch = scrubbed.match(/\d{4}-\d{2}-\d{2}/)
    if (dateMatch) {
      errors.push({
        level: 'error',
        code: 'rule-date',
        message: `rule contains date ${dateMatch[0]} outside a Decision: link`,
        file,
      })
    }
  }

  if (alwaysApplyBytes > ALWAYS_APPLY_BUDGET_BYTES) {
    errors.push({
      level: 'error',
      code: 'always-apply-oversize',
      message: `alwaysApply: true rules total ${alwaysApplyBytes} bytes (budget ${ALWAYS_APPLY_BUDGET_BYTES})`,
      file: '.cursor/rules',
    })
  }
}

export async function auditDocs(options: AuditDocsOptions = {}): Promise<DocsReport> {
  const root = options.root ?? ROOT
  const now = options.now ?? new Date()
  const errors: DocsIssue[] = []
  const warnings: DocsIssue[] = []

  await checkFrontmatterAndSuperseded(root, errors, warnings, now)
  await checkScopedLinks(root, errors)
  await checkRules(root, errors)

  return { errors, warnings }
}

function printReport(report: DocsReport): boolean {
  for (const warning of report.warnings) {
    console.warn(`warning: [${warning.code}] ${warning.file}: ${warning.message}`)
  }
  for (const error of report.errors) {
    console.error(`error: [${error.code}] ${error.file}: ${error.message}`)
  }
  if (report.errors.length === 0) {
    console.log(
      `check:docs ok (${report.warnings.length} warning${report.warnings.length === 1 ? '' : 's'})`,
    )
    return true
  }
  console.error(`check:docs failed with ${report.errors.length} error(s)`)
  return false
}

function invokedDirectly(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  const invoked = path.resolve(entry).replace(/\\/g, '/').toLowerCase()
  const self = fileURLToPath(import.meta.url).replace(/\\/g, '/').toLowerCase()
  return invoked === self
}

async function main(): Promise<void> {
  const report = await auditDocs()
  if (!printReport(report)) process.exitCode = 1
}

if (invokedDirectly()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}

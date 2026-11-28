/**
 * Migration journal and destructive-SQL checker (slice L2).
 *
 * Fails when a `src/core/db/migrations/*.sql` file is missing from
 * `meta/_journal.json`, or when a migration contains DROP TABLE, DROP COLUMN,
 * or TRUNCATE without an `-- approved:destructive <reason>` line.
 *
 * Journal exemption (once): `0048_drop_payload_schema.sql` runs after the
 * idempotent sf_* copy and must not be in the journal.
 *
 * Usage: npm run check:migrations
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** `0048_drop_payload_schema.sql` runs after the idempotent sf_* copy and must not be in the journal. */
export const JOURNAL_EXEMPT_MIGRATION = '0048_drop_payload_schema.sql'

const DESTRUCTIVE_SQL =
  /\bDROP\s+TABLE\b|\bDROP\s+COLUMN\b|\bTRUNCATE\b/i

const APPROVAL_LINE = /^\s*--\s*approved:destructive\s+(\S.*?)\s*$/

export type MigrationsIssue = {
  level: 'error'
  code: 'missing-journal-entry' | 'unapproved-destructive'
  message: string
  file: string
}

export type MigrationsReport = {
  errors: MigrationsIssue[]
}

export type AuditMigrationsOptions = {
  root?: string
}

type JournalFile = {
  entries?: Array<{ tag?: string }>
}

function toPosix(p: string): string {
  return p.replace(/\\/g, '/')
}

function relToRoot(root: string, abs: string): string {
  return toPosix(path.relative(root, abs))
}

function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')
}

function hasDestructiveApproval(sql: string): boolean {
  return sql.split(/\r?\n/).some((line) => APPROVAL_LINE.test(line))
}

export function findUnapprovedDestructive(sql: string): boolean {
  if (hasDestructiveApproval(sql)) return false
  return DESTRUCTIVE_SQL.test(stripSqlComments(sql))
}

async function readJournalTags(journalPath: string): Promise<Set<string>> {
  let raw: string
  try {
    raw = await readFile(journalPath, 'utf8')
  } catch {
    return new Set()
  }
  let parsed: JournalFile
  try {
    parsed = JSON.parse(raw) as JournalFile
  } catch {
    return new Set()
  }
  const tags = new Set<string>()
  for (const entry of parsed.entries ?? []) {
    if (typeof entry.tag === 'string' && entry.tag.trim()) tags.add(entry.tag.trim())
  }
  return tags
}

export async function auditMigrations(
  options: AuditMigrationsOptions = {},
): Promise<MigrationsReport> {
  const root = options.root ?? ROOT
  const migrationsDir = path.join(root, 'src', 'core', 'db', 'migrations')
  const errors: MigrationsIssue[] = []

  let names: string[] = []
  try {
    const entries = await readdir(migrationsDir, { withFileTypes: true })
    names = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
      .map((entry) => entry.name)
      .sort()
  } catch {
    return { errors }
  }

  const tags = await readJournalTags(path.join(migrationsDir, 'meta', '_journal.json'))

  for (const name of names) {
    const file = relToRoot(root, path.join(migrationsDir, name))
    const tag = name.slice(0, -'.sql'.length)
    if (!tags.has(tag) && name !== JOURNAL_EXEMPT_MIGRATION) {
      errors.push({
        level: 'error',
        code: 'missing-journal-entry',
        message: `${name} is missing from meta/_journal.json`,
        file,
      })
    }

    const sql = await readFile(path.join(migrationsDir, name), 'utf8')
    if (findUnapprovedDestructive(sql)) {
      errors.push({
        level: 'error',
        code: 'unapproved-destructive',
        message:
          'DROP TABLE, DROP COLUMN, or TRUNCATE requires an `-- approved:destructive <reason>` line',
        file,
      })
    }
  }

  return { errors }
}

function printReport(report: MigrationsReport): boolean {
  for (const error of report.errors) {
    console.error(`error: [${error.code}] ${error.file}: ${error.message}`)
  }
  if (report.errors.length === 0) {
    console.log('check:migrations ok')
    return true
  }
  console.error(`check:migrations failed with ${report.errors.length} error(s)`)
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
  const report = await auditMigrations()
  if (!printReport(report)) process.exitCode = 1
}

if (invokedDirectly()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}

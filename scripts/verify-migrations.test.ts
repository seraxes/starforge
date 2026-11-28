/**
 * Fixture tests for check:migrations (slice L2).
 * Success on the real repo; failure on a missing journal entry and an
 * unapproved DROP COLUMN.
 */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

import { auditMigrations, type MigrationsIssue } from './verify-migrations'

const FIXTURE_ROOTS: string[] = []

after(async () => {
  await Promise.all(FIXTURE_ROOTS.map((dir) => rm(dir, { recursive: true, force: true })))
})

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sf-verify-migrations-'))
  FIXTURE_ROOTS.push(root)
  await mkdir(path.join(root, 'src', 'core', 'db', 'migrations', 'meta'), { recursive: true })
  return root
}

function journal(tags: string[]): string {
  return JSON.stringify({
    version: '7',
    dialect: 'postgresql',
    entries: tags.map((tag, idx) => ({
      idx,
      version: '7',
      when: 1,
      tag,
      breakpoints: true,
    })),
  })
}

async function writeMigration(root: string, name: string, sql: string): Promise<void> {
  await writeFile(path.join(root, 'src', 'core', 'db', 'migrations', name), sql)
}

async function writeJournal(root: string, tags: string[]): Promise<void> {
  await writeFile(
    path.join(root, 'src', 'core', 'db', 'migrations', 'meta', '_journal.json'),
    journal(tags),
  )
}

function codes(issues: MigrationsIssue[]): string[] {
  return issues.map((issue) => issue.code)
}

describe('verify-migrations', () => {
  it('success: the real repo journal and destructive-SQL rules pass', async () => {
    const report = await auditMigrations()
    assert.equal(
      report.errors.filter((error) => error.file.includes('0048_drop_payload_schema.sql')).length,
      0,
    )
    assert.deepEqual(report.errors, [])
  })

  it('failure: sql file missing from meta/_journal.json', async () => {
    const root = await makeRoot()
    await writeMigration(root, '0001_ok.sql', 'SELECT 1;\n')
    await writeMigration(root, '0002_missing.sql', 'SELECT 1;\n')
    await writeJournal(root, ['0001_ok'])
    const report = await auditMigrations({ root })
    assert.ok(
      report.errors.some(
        (error) =>
          error.code === 'missing-journal-entry' && error.file.includes('0002_missing.sql'),
      ),
    )
    assert.equal(
      report.errors.filter((error) => error.file.endsWith('0001_ok.sql')).length,
      0,
    )
  })

  it('failure: unapproved DROP COLUMN', async () => {
    const root = await makeRoot()
    await writeMigration(
      root,
      '0001_drop.sql',
      'ALTER TABLE "sf_layouts" DROP COLUMN "skin_id";\n',
    )
    await writeJournal(root, ['0001_drop'])
    const report = await auditMigrations({ root })
    assert.ok(codes(report.errors).includes('unapproved-destructive'))
    assert.ok(
      report.errors.some(
        (error) =>
          error.code === 'unapproved-destructive' && error.file.includes('0001_drop.sql'),
      ),
    )
  })

  it('success: DROP COLUMN with an approved:destructive reason is allowed', async () => {
    const root = await makeRoot()
    await writeMigration(
      root,
      '0001_drop.sql',
      '-- approved:destructive remove a column copied into sf_*\nALTER TABLE "sf_layouts" DROP COLUMN "skin_id";\n',
    )
    await writeJournal(root, ['0001_drop'])
    const report = await auditMigrations({ root })
    assert.deepEqual(report.errors, [])
  })
})

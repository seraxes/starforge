/**
 * Fixture tests for check:docs (slice D5).
 * Success and failure paths for each enforced check.
 */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

import { auditDocs, type DocsIssue } from './verify-docs'

const FIXTURE_ROOTS: string[] = []

after(async () => {
  await Promise.all(FIXTURE_ROOTS.map((dir) => rm(dir, { recursive: true, force: true })))
})

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sf-verify-docs-'))
  FIXTURE_ROOTS.push(root)
  await mkdir(path.join(root, 'docs', 'project-context', 'docs'), { recursive: true })
  await mkdir(path.join(root, 'docs', 'ops'), { recursive: true })
  await mkdir(path.join(root, 'docs', 'archive'), { recursive: true })
  await mkdir(path.join(root, '.cursor', 'rules'), { recursive: true })
  return root
}

function fm(fields: Record<string, string>, body: string): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`)
  return `---\n${lines.join('\n')}\n---\n${body}`
}

async function seedMinimalPassing(root: string): Promise<void> {
  await writeFile(
    path.join(root, 'docs', 'project-context', 'docs', 'architecture-current.md'),
    fm({ kind: 'live', last_verified: '2026-11-22' }, '# Live\n\nSee [ops](../../ops/deploy.md).\n'),
  )
  await writeFile(
    path.join(root, 'docs', 'ops', 'deploy.md'),
    fm({ kind: 'reference', last_verified: '2026-11-22' }, '# Deploy\n'),
  )
  await writeFile(
    path.join(root, 'docs', 'archive', 'old.md'),
    '# Archive without frontmatter is fine\n',
  )
  await writeFile(path.join(root, 'AGENTS.md'), '# Agents\n\n[Live](docs/project-context/docs/architecture-current.md)\n')
  await writeFile(
    path.join(root, '.cursor', 'rules', 'sf-ok.mdc'),
    fm({ description: 'A short always-apply rule.', alwaysApply: 'true' }, '# Ok\n\nLaw only.\n'),
  )
  await writeFile(
    path.join(root, '.cursor', 'rules', 'sf-glob.mdc'),
    fm(
      {
        description: 'Glob-scoped rule.',
        globs: '"docs/**"',
        alwaysApply: 'false',
      },
      '# Glob\n\nDecision: [2026-11-22-example](../../docs/project-context/docs/architecture-current.md)\n',
    ),
  )
}

function codes(issues: DocsIssue[]): string[] {
  return issues.map((i) => i.code).sort()
}

describe('verify-docs', () => {
  it('success: minimal fixture passes all checks', async () => {
    const root = await makeRoot()
    await seedMinimalPassing(root)
    const report = await auditDocs({ root, now: new Date('2026-11-22T12:00:00Z') })
    assert.deepEqual(report.errors, [])
    assert.deepEqual(report.warnings, [])
  })

  it('failure: missing frontmatter under docs/project-context/docs or docs/ops', async () => {
    const root = await makeRoot()
    await seedMinimalPassing(root)
    await writeFile(path.join(root, 'docs', 'ops', 'bare.md'), '# No frontmatter\n')
    const report = await auditDocs({ root, now: new Date('2026-11-22T12:00:00Z') })
    assert.ok(report.errors.some((e) => e.code === 'missing-frontmatter' && e.file.includes('docs/ops/bare.md')))
  })

  it('success: docs/archive may omit frontmatter', async () => {
    const root = await makeRoot()
    await seedMinimalPassing(root)
    const report = await auditDocs({ root, now: new Date('2026-11-22T12:00:00Z') })
    assert.equal(
      report.errors.filter((e) => e.code === 'missing-frontmatter').length,
      0,
    )
  })

  it('failure: superseded_by target missing', async () => {
    const root = await makeRoot()
    await seedMinimalPassing(root)
    await writeFile(
      path.join(root, 'docs', 'project-context', 'docs', 'old-design.md'),
      fm(
        { kind: 'superseded', last_verified: '2026-11-22', superseded_by: 'does-not-exist.md' },
        '# Superseded\n',
      ),
    )
    const report = await auditDocs({ root, now: new Date('2026-11-22T12:00:00Z') })
    assert.ok(report.errors.some((e) => e.code === 'superseded-by-missing'))
  })

  it('success: superseded_by resolves relative to the doc', async () => {
    const root = await makeRoot()
    await seedMinimalPassing(root)
    await writeFile(
      path.join(root, 'docs', 'project-context', 'docs', 'old-design.md'),
      fm(
        { kind: 'superseded', last_verified: '2026-11-22', superseded_by: 'architecture-current.md' },
        '# Superseded\n',
      ),
    )
    const report = await auditDocs({ root, now: new Date('2026-11-22T12:00:00Z') })
    assert.equal(report.errors.filter((e) => e.code === 'superseded-by-missing').length, 0)
  })

  it('failure: broken relative link in architecture-current, AGENTS.md, or rules', async () => {
    const root = await makeRoot()
    await seedMinimalPassing(root)
    await writeFile(
      path.join(root, 'docs', 'project-context', 'docs', 'architecture-current.md'),
      fm({ kind: 'live', last_verified: '2026-11-22' }, '# Live\n\n[missing](./nope.md)\n'),
    )
    const report = await auditDocs({ root, now: new Date('2026-11-22T12:00:00Z') })
    assert.ok(report.errors.some((e) => e.code === 'broken-link'))
  })

  it('success: live map may link into docs/archive as history', async () => {
    const root = await makeRoot()
    await seedMinimalPassing(root)
    await writeFile(
      path.join(root, 'docs', 'project-context', 'docs', 'architecture-current.md'),
      fm(
        { kind: 'live', last_verified: '2026-11-22' },
        '# Live\n\nArchive: [old](../../archive/old.md).\n',
      ),
    )
    const report = await auditDocs({ root, now: new Date('2026-11-22T12:00:00Z') })
    assert.equal(report.errors.filter((e) => e.code === 'broken-link').length, 0)
  })

  it('success: /cursor/stores/ links are ignored', async () => {
    const root = await makeRoot()
    await seedMinimalPassing(root)
    await writeFile(
      path.join(root, 'AGENTS.md'),
      '# Agents\n\n[store](/cursor/stores/self/docs/x.md)\n\n[Live](docs/project-context/docs/architecture-current.md)\n',
    )
    const report = await auditDocs({ root, now: new Date('2026-11-22T12:00:00Z') })
    assert.equal(report.errors.filter((e) => e.code === 'broken-link').length, 0)
  })

  it('failure: rule has both globs and alwaysApply: true', async () => {
    const root = await makeRoot()
    await seedMinimalPassing(root)
    await writeFile(
      path.join(root, '.cursor', 'rules', 'sf-both.mdc'),
      fm(
        { description: 'Bad combo.', globs: '"src/**"', alwaysApply: 'true' },
        '# Both\n',
      ),
    )
    const report = await auditDocs({ root, now: new Date('2026-11-22T12:00:00Z') })
    assert.ok(report.errors.some((e) => e.code === 'rule-globs-and-always-apply'))
  })

  it('success: globs with alwaysApply: false is allowed', async () => {
    const root = await makeRoot()
    await seedMinimalPassing(root)
    const report = await auditDocs({ root, now: new Date('2026-11-22T12:00:00Z') })
    assert.equal(report.errors.filter((e) => e.code === 'rule-globs-and-always-apply').length, 0)
  })

  it('failure: alwaysApply rules total more than 15 KB', async () => {
    const root = await makeRoot()
    await seedMinimalPassing(root)
    const padding = 'x'.repeat(16 * 1024)
    await writeFile(
      path.join(root, '.cursor', 'rules', 'sf-huge.mdc'),
      fm({ description: 'Huge always-apply rule.', alwaysApply: 'true' }, `# Huge\n\n${padding}\n`),
    )
    const report = await auditDocs({ root, now: new Date('2026-11-22T12:00:00Z') })
    assert.ok(report.errors.some((e) => e.code === 'always-apply-oversize'))
  })

  it('success: alwaysApply total within 15 KB budget', async () => {
    const root = await makeRoot()
    await seedMinimalPassing(root)
    const report = await auditDocs({ root, now: new Date('2026-11-22T12:00:00Z') })
    assert.equal(report.errors.filter((e) => e.code === 'always-apply-oversize').length, 0)
  })

  it('failure: rule contains YYYY-MM-DD outside a Decision: link', async () => {
    const root = await makeRoot()
    await seedMinimalPassing(root)
    await writeFile(
      path.join(root, '.cursor', 'rules', 'sf-dated.mdc'),
      fm({ description: 'Dated rule.', alwaysApply: 'true' }, '# Dated\n\nAs of 2026-11-01 this changed.\n'),
    )
    const report = await auditDocs({ root, now: new Date('2026-11-22T12:00:00Z') })
    assert.ok(report.errors.some((e) => e.code === 'rule-date'))
  })

  it('success: YYYY-MM-DD inside a Decision: link is allowed', async () => {
    const root = await makeRoot()
    await seedMinimalPassing(root)
    const report = await auditDocs({ root, now: new Date('2026-11-22T12:00:00Z') })
    assert.equal(report.errors.filter((e) => e.code === 'rule-date').length, 0)
  })

  it('warning only: kind live last_verified older than 30 days', async () => {
    const root = await makeRoot()
    await seedMinimalPassing(root)
    await writeFile(
      path.join(root, 'docs', 'project-context', 'docs', 'architecture-current.md'),
      fm({ kind: 'live', last_verified: '2026-01-01' }, '# Live\n\nSee [ops](../../ops/deploy.md).\n'),
    )
    const report = await auditDocs({ root, now: new Date('2026-11-22T12:00:00Z') })
    assert.ok(report.warnings.some((w) => w.code === 'live-stale'))
    assert.equal(report.errors.filter((e) => e.code === 'live-stale').length, 0)
    assert.ok(!codes(report.errors).includes('live-stale'))
  })

  it('success: reference and decision kinds are not staleness-checked', async () => {
    const root = await makeRoot()
    await seedMinimalPassing(root)
    await writeFile(
      path.join(root, 'docs', 'ops', 'deploy.md'),
      fm({ kind: 'reference', last_verified: '2020-01-01' }, '# Deploy\n'),
    )
    await mkdir(path.join(root, 'docs', 'project-context', 'docs', 'decisions'), { recursive: true })
    await writeFile(
      path.join(root, 'docs', 'project-context', 'docs', 'decisions', 'old.md'),
      fm({ kind: 'decision', last_verified: '2020-01-01' }, '# Decision\n'),
    )
    const report = await auditDocs({ root, now: new Date('2026-11-22T12:00:00Z') })
    assert.equal(report.warnings.filter((w) => w.code === 'live-stale').length, 0)
  })
})

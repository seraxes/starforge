/**
 * Fixture tests for check:tests (slice L1).
 * Success and failure paths for registration and listed-path existence.
 */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

import {
  auditTestsRegistered,
  expandNpmRunScript,
  parseTestUnitListedPaths,
} from './verify-tests-registered'

const FIXTURE_ROOTS: string[] = []

after(async () => {
  await Promise.all(FIXTURE_ROOTS.map((dir) => rm(dir, { recursive: true, force: true })))
})

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sf-verify-tests-'))
  FIXTURE_ROOTS.push(root)
  await mkdir(path.join(root, 'src', 'core'), { recursive: true })
  return root
}

describe('parseTestUnitListedPaths', () => {
  it('reads quoted and bare test paths from a tsx --test script', () => {
    const listed = parseTestUnitListedPaths(
      'tsx --test src/a.test.ts "src/app/(x)/b.test.ts" && tsx --test src/c.test.tsx',
    )
    assert.deepEqual(listed, [
      'src/a.test.ts',
      'src/app/(x)/b.test.ts',
      'src/c.test.tsx',
    ])
  })
})

describe('expandNpmRunScript', () => {
  it('inlines npm run batches used by test:unit', () => {
    const expanded = expandNpmRunScript('test:unit', {
      'test:unit': 'npm run test:unit:1 && npm run test:unit:stub',
      'test:unit:1': 'tsx --test src/a.test.ts',
      'test:unit:stub': 'tsx --test src/b.test.ts',
    })
    assert.equal(parseTestUnitListedPaths(expanded).join(','), 'src/a.test.ts,src/b.test.ts')
  })
})

describe('verify-tests-registered', () => {
  it('success: every src test is listed and every listed path exists', async () => {
    const root = await makeRoot()
    await writeFile(path.join(root, 'src', 'core', 'money.test.ts'), 'export {}\n')
    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        scripts: {
          'test:unit': 'npm run test:unit:1',
          'test:unit:1': 'tsx --test src/core/money.test.ts',
        },
      }),
    )
    const report = await auditTestsRegistered({ root })
    assert.deepEqual(report.errors, [])
  })

  it('failure: src test file missing from test:unit', async () => {
    const root = await makeRoot()
    await writeFile(path.join(root, 'src', 'core', 'money.test.ts'), 'export {}\n')
    await writeFile(path.join(root, 'src', 'core', 'orphan.test.ts'), 'export {}\n')
    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        scripts: {
          'test:unit': 'npm run test:unit:1',
          'test:unit:1': 'tsx --test src/core/money.test.ts',
        },
      }),
    )
    const report = await auditTestsRegistered({ root })
    assert.ok(
      report.errors.some(
        (e) => e.code === 'unregistered-src-test' && e.file === 'src/core/orphan.test.ts',
      ),
    )
  })

  it('failure: listed path does not exist', async () => {
    const root = await makeRoot()
    await writeFile(path.join(root, 'src', 'core', 'money.test.ts'), 'export {}\n')
    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        scripts: {
          'test:unit': 'npm run test:unit:1',
          'test:unit:1': 'tsx --test src/core/money.test.ts src/core/missing.test.ts',
        },
      }),
    )
    const report = await auditTestsRegistered({ root })
    assert.ok(
      report.errors.some(
        (e) => e.code === 'listed-path-missing' && e.file === 'src/core/missing.test.ts',
      ),
    )
  })
})

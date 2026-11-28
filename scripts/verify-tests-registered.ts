/**
 * Ensures every `src/**\/*.test.ts` is listed in `package.json` `test:unit`
 * (including `npm run test:unit:*` batches), and every listed path exists.
 * `e2e/**` and `scripts/**` stay on their own npm scripts.
 *
 * Usage: npm run check:tests
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export type TestsRegisteredIssue = {
  level: 'error'
  code: 'unregistered-src-test' | 'listed-path-missing'
  message: string
  file: string
}

export type TestsRegisteredReport = {
  errors: TestsRegisteredIssue[]
}

export type AuditTestsRegisteredOptions = {
  root?: string
  /** Override package scripts map (tests). */
  scripts?: Record<string, string>
  /** Override discovered `src/**\/*.test.ts` paths relative to root (tests). */
  srcTestFiles?: string[]
}

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

async function walkSrcTestTs(dir: string): Promise<string[]> {
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
      out.push(...(await walkSrcTestTs(abs)))
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.test.ts')) out.push(abs)
  }
  return out
}

/**
 * Collect test file args from a `tsx --test …` style script (quoted or bare).
 */
export function parseTestUnitListedPaths(script: string): string[] {
  const listed: string[] = []
  const re = /(?:"([^"]+\.test\.tsx?)"|(\S+\.test\.tsx?))/g
  for (const match of script.matchAll(re)) {
    const rel = match[1] ?? match[2]
    if (rel) listed.push(toPosix(rel))
  }
  return listed
}

/**
 * Expand `npm run <script>` references so Windows-safe `test:unit` batches still count.
 */
export function expandNpmRunScript(
  scriptName: string,
  scripts: Record<string, string>,
  seen = new Set<string>(),
): string {
  if (seen.has(scriptName)) return ''
  seen.add(scriptName)
  const body = scripts[scriptName] ?? ''
  return body.replace(/npm run ([^\s&|;]+)/g, (_full, name: string) => {
    return expandNpmRunScript(name, scripts, seen)
  })
}

export function listedPathsFromTestUnit(scripts: Record<string, string>): string[] {
  const expanded = expandNpmRunScript('test:unit', scripts)
  return parseTestUnitListedPaths(expanded)
}

export async function auditTestsRegistered(
  options: AuditTestsRegisteredOptions = {},
): Promise<TestsRegisteredReport> {
  const root = options.root ?? ROOT
  const errors: TestsRegisteredIssue[] = []

  let scripts = options.scripts
  if (scripts === undefined) {
    const raw = await readFile(path.join(root, 'package.json'), 'utf8')
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> }
    scripts = pkg.scripts ?? {}
  }

  const listed = listedPathsFromTestUnit(scripts)
  const listedSet = new Set(listed)

  let srcTests: string[]
  if (options.srcTestFiles) {
    srcTests = options.srcTestFiles.map(toPosix)
  } else {
    const absFiles = await walkSrcTestTs(path.join(root, 'src'))
    srcTests = absFiles.map((abs) => relToRoot(root, abs)).sort()
  }

  for (const file of srcTests) {
    if (!listedSet.has(file)) {
      errors.push({
        level: 'error',
        code: 'unregistered-src-test',
        message: 'src test file is not listed in package.json scripts.test:unit',
        file,
      })
    }
  }

  for (const file of listed) {
    const abs = path.join(root, file)
    if (!(await pathExists(abs))) {
      errors.push({
        level: 'error',
        code: 'listed-path-missing',
        message: 'test:unit lists a path that does not exist',
        file,
      })
    }
  }

  return { errors }
}

function printReport(report: TestsRegisteredReport): boolean {
  for (const error of report.errors) {
    console.error(`error: [${error.code}] ${error.file}: ${error.message}`)
  }
  if (report.errors.length === 0) {
    console.log('check:tests ok')
    return true
  }
  console.error(`check:tests failed with ${report.errors.length} error(s)`)
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
  const report = await auditTestsRegistered()
  if (!printReport(report)) process.exitCode = 1
}

if (invokedDirectly()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}

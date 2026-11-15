import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runModuleBoot, type ModuleBootLoader } from './module-boot'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

function loader(moduleId: string, run: () => void | Promise<void>): ModuleBootLoader {
  return {
    moduleId,
    load: async () => run,
  }
}

describe('runModuleBoot', () => {
  it('runs loaders in the supplied order and repeats that order', async () => {
    const first: string[] = []
    const second: string[] = []
    const list = (target: string[]): ModuleBootLoader[] => [
      loader('z', () => {
        target.push('z')
      }),
      loader('m', () => {
        target.push('m')
      }),
      loader('a', () => {
        target.push('a')
      }),
    ]

    await runModuleBoot(list(first))
    await runModuleBoot(list(second))

    assert.deepEqual(first, ['z', 'm', 'a'])
    assert.deepEqual(second, ['z', 'm', 'a'])
  })

  it('skips a failing loader and still runs the rest', async () => {
    const calls: string[] = []
    await runModuleBoot([
      loader('a', () => {
        calls.push('a')
      }),
      {
        moduleId: 'b',
        load: async () => {
          throw new Error('load failed')
        },
      },
      loader('c', () => {
        calls.push('c')
        throw new Error('boot failed')
      }),
      loader('d', async () => {
        calls.push('d')
      }),
    ])
    assert.deepEqual(calls, ['a', 'c', 'd'])
  })

  it('resolves an empty loader list', async () => {
    await runModuleBoot([])
  })
})

describe('instrumentation boot wiring', () => {
  it('keeps the edge guard ahead of Node boot and names no pack path', async () => {
    const text = await readFile(path.join(ROOT, 'src/instrumentation.ts'), 'utf8')
    const edgeAt = text.indexOf("process.env.NEXT_RUNTIME === 'edge'")
    const bootAt = text.indexOf('runModuleBoot')
    assert.ok(edgeAt >= 0)
    assert.ok(bootAt > edgeAt)
    assert.equal(text.includes('modules/events'), false)
    assert.equal(text.includes('modules/subscriptions'), false)
    assert.equal(text.includes('modules/email-manager'), false)
    assert.equal(text.includes('Events'), false)
    assert.equal(text.includes('Subscriptions'), false)
    assert.equal(text.includes('Email Manager'), false)
  })

  it('returns on the edge runtime before Node boot imports', async () => {
    const previous = process.env.NEXT_RUNTIME
    process.env.NEXT_RUNTIME = 'edge'
    try {
      const { register } = await import('../../instrumentation')
      await register()
    } finally {
      if (previous === undefined) delete process.env.NEXT_RUNTIME
      else process.env.NEXT_RUNTIME = previous
    }
  })

  it('generated boot loaders follow the Stage 6 order', async () => {
    const text = await readFile(path.join(ROOT, 'src/generated/module-registry.server.ts'), 'utf8')
    const start = text.indexOf('export const bootLoaders')
    const end = text.indexOf('export async function runModuleBoot')
    assert.ok(start >= 0)
    assert.ok(end > start)
    const block = text.slice(start, end)
    const ids = [...block.matchAll(/moduleId: "([^"]+)"/g)].map((match) => match[1])
    assert.deepEqual(ids, [
      'product:email-manager',
      'product:profiles',
      'product:events',
      'product:subscriptions',
    ])
    assert.match(block, /@\/modules\/email-manager\/boot/)
    assert.match(block, /bootEmailManager/)
    assert.match(block, /@\/modules\/profiles\/boot/)
    assert.match(block, /bootProfiles/)
    assert.match(block, /@\/modules\/events\/boot/)
    assert.match(block, /bootEvents/)
    assert.match(block, /@\/modules\/subscriptions\/boot/)
    assert.match(block, /bootSubscriptions/)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { registerJobHandler } from './handlers'
import {
  createMemoryJobRunner,
  resetMemoryJobRunnerForTests,
} from './memory'
import { getJobRunner, resetJobRunnerForTests } from './index'

function waitFor(
  predicate: () => boolean,
  { timeoutMs = 1000, intervalMs = 10 } = {},
): Promise<void> {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) {
        resolve()
        return
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error('waitFor timed out'))
        return
      }
      setTimeout(tick, intervalMs)
    }
    tick()
  })
}

describe('memory JobRunner', () => {
  it('runs a named handler once; same idempotency key does not run twice', async () => {
    resetJobRunnerForTests()
    let ran = 0
    registerJobHandler('test.ping', () => {
      ran += 1
    })

    const runner = createMemoryJobRunner()
    const first = await runner.enqueue({
      name: 'test.ping',
      payload: { n: 1 },
      idempotencyKey: 'ping-1',
    })
    assert.equal(first.ok, true)
    assert.equal(first.deduped, undefined)

    await waitFor(() => ran === 1)

    const second = await runner.enqueue({
      name: 'test.ping',
      payload: { n: 2 },
      idempotencyKey: 'ping-1',
    })
    assert.equal(second.ok, true)
    assert.equal(second.deduped, true)

    await new Promise((r) => setTimeout(r, 40))
    assert.equal(ran, 1)
    resetJobRunnerForTests()
  })

  it('unknown job names soft-fail without throwing', async () => {
    resetJobRunnerForTests()
    const runner = createMemoryJobRunner()
    const result = await runner.enqueue({ name: 'test.missing', payload: {} })
    assert.equal(result.ok, false)
    assert.match(result.error ?? '', /Unknown job/)
    resetJobRunnerForTests()
  })

  it('handler errors do not reject enqueue', async () => {
    resetJobRunnerForTests()
    let attempted = 0
    registerJobHandler('test.boom', () => {
      attempted += 1
      throw new Error('boom')
    })

    const runner = createMemoryJobRunner()
    const result = await runner.enqueue({ name: 'test.boom', payload: {} })
    assert.equal(result.ok, true)

    await waitFor(() => attempted === 1)
    resetJobRunnerForTests()
  })

  it('getJobRunner().info() reports memory when REDIS_URL is unset', () => {
    const saved = process.env.REDIS_URL
    try {
      delete process.env.REDIS_URL
      resetJobRunnerForTests()
      const info = getJobRunner().info()
      assert.equal(info.adapter, 'memory')
      assert.equal(info.ready, true)
      assert.equal(getJobRunner(), getJobRunner())
    } finally {
      if (saved === undefined) delete process.env.REDIS_URL
      else process.env.REDIS_URL = saved
      resetJobRunnerForTests()
      resetMemoryJobRunnerForTests()
    }
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { canSubscribe, filterSubscribableChannels, userChannel } from './channels'
import {
  clearMemoryRealtimeBus,
  createMemoryRealtimePort,
  getRealtimePort,
  resetRealtimePortForTests,
} from './memory'
import {
  resetRealtimeRuntimeConfig,
  setRealtimeRuntimeConfig,
} from './runtime-config'

describe('memory RealtimePort', () => {
  it('delivers publish to matching subscribers', async () => {
    clearMemoryRealtimeBus()
    const port = createMemoryRealtimePort()
    const received: string[] = []

    const unsub = port.subscribe('user:alice', (event) => {
      received.push(`${event.type}:${event.channel}`)
    })

    await port.publish('user:alice', 'notification.created', { id: '1' })
    await port.publish('user:bob', 'notification.created', { id: '2' })

    assert.deepEqual(received, ['notification.created:user:alice'])
    unsub()

    await port.publish('user:alice', 'notification.created', { id: '3' })
    assert.deepEqual(received, ['notification.created:user:alice'])
  })

  it('rejects empty channel or type on publish', async () => {
    clearMemoryRealtimeBus()
    const port = createMemoryRealtimePort()
    await assert.rejects(() => port.publish('  ', 'x'), /channel is required/)
    await assert.rejects(() => port.publish('user:a', '  '), /type is required/)
  })

  it('getRealtimePort returns a process singleton', () => {
    resetRealtimePortForTests()
    clearMemoryRealtimeBus()
    resetRealtimeRuntimeConfig()
    const a = getRealtimePort()
    const b = getRealtimePort()
    assert.equal(a, b)
    assert.equal(a.info().adapter, 'memory')
    assert.equal(a.info().ready, true)
    resetRealtimePortForTests()
  })

  it('skips fan-out when realtime runtime is disabled', async () => {
    clearMemoryRealtimeBus()
    resetRealtimeRuntimeConfig()
    const port = createMemoryRealtimePort()
    const received: string[] = []
    const unsub = port.subscribe('user:alice', (event) => {
      received.push(event.id)
    })

    setRealtimeRuntimeConfig({ enabled: false })
    assert.equal(port.info().ready, false)
    await port.publish('user:alice', 'notification.created', {})
    assert.deepEqual(received, [])

    setRealtimeRuntimeConfig({ enabled: true })
    await port.publish('user:alice', 'notification.created', {})
    assert.equal(received.length, 1)
    unsub()
    resetRealtimeRuntimeConfig()
  })
})

describe('realtime channel ACL', () => {
  it('allows only the session user personal channel', () => {
    assert.equal(canSubscribe('u1', userChannel('u1')), true)
    assert.equal(canSubscribe('u1', userChannel('u2')), false)
    assert.equal(canSubscribe('u1', 'chat:room-1'), false)

    const filtered = filterSubscribableChannels('u1', [
      userChannel('u1'),
      userChannel('u2'),
      'chat:room-1',
    ])
    assert.deepEqual(filtered.allowed, [userChannel('u1')])
    assert.deepEqual(filtered.rejected, [userChannel('u2'), 'chat:room-1'])
  })
})

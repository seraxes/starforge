import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { inviteOnboardingPerson, type InviteDeps } from './invite'

function memoryDeps(overrides?: Partial<InviteDeps> & { enabled?: boolean }): {
  deps: InviteDeps
  createdUsers: Array<{ name: string; email: string; password: string }>
  mailLogs: Array<{ channel: string; toEmail: string; userId: string }>
  emits: Array<{ triggerKey: string }>
} {
  const createdUsers: Array<{ name: string; email: string; password: string }> = []
  const mailLogs: Array<{ channel: string; toEmail: string; userId: string }> = []
  const emits: Array<{ triggerKey: string }> = []
  const enabled = overrides?.enabled !== false

  const deps: InviteDeps = {
    isEnabled: overrides?.isEnabled ?? enabled,
    findUserByEmail: overrides?.findUserByEmail ?? (async () => null),
    createUser:
      overrides?.createUser ??
      (async (input) => {
        createdUsers.push(input)
        return { id: `user_${createdUsers.length}` }
      }),
    getRecruitingStatusId: overrides?.getRecruitingStatusId ?? (async () => 'status_recruiting'),
    writeIdentity:
      overrides?.writeIdentity ??
      (async () => ({ ok: true as const })),
    createResetLink:
      overrides?.createResetLink ?? (async () => 'https://example.test/reset-password?token=abc'),
    applicationFormLink: overrides?.applicationFormLink ?? (() => 'https://example.test/account'),
    emitMail:
      overrides?.emitMail ??
      (async (input) => {
        emits.push({ triggerKey: input.triggerKey })
      }),
    recordMailLog:
      overrides?.recordMailLog ??
      (async (input) => {
        mailLogs.push({
          channel: input.channel,
          toEmail: input.toEmail,
          userId: input.userId,
        })
      }),
    generatePassword: overrides?.generatePassword ?? (() => 'TestOnly!Passw0rd-never-import'),
    senderUserId: overrides?.senderUserId ?? 'staff_1',
  }

  return { deps, createdUsers, mailLogs, emits }
}

describe('inviteOnboardingPerson', () => {
  it('creates a Core user and records the account_invite mail log (success path)', async () => {
    const { deps, createdUsers, mailLogs, emits } = memoryDeps()
    const door = await inviteOnboardingPerson(
      { name: 'Ada Driver', email: 'ada@example.test', phone: '+361111' },
      deps,
    )

    assert.equal(door.ok, true)
    if (!door.ok) return
    assert.equal(door.value.ok, true)
    if (!door.value.ok) return

    assert.equal(createdUsers.length, 1)
    assert.equal(createdUsers[0]?.email, 'ada@example.test')
    assert.equal(createdUsers[0]?.name, 'Ada Driver')
    assert.ok(createdUsers[0]?.password)
    assert.equal(door.value.userId, 'user_1')
    assert.equal(door.value.statusId, 'status_recruiting')

    assert.equal(mailLogs.length, 1)
    assert.equal(mailLogs[0]?.channel, 'account_invite')
    assert.equal(mailLogs[0]?.toEmail, 'ada@example.test')
    assert.equal(mailLogs[0]?.userId, 'user_1')

    assert.ok(emits.some((e) => e.triggerKey === 'product:onboarding/account_invite'))
    assert.ok(emits.some((e) => e.triggerKey === 'product:onboarding/application'))
  })

  it('is refused when Onboarding is off and does not create a user (failure path)', async () => {
    const { deps, createdUsers, mailLogs, emits } = memoryDeps({ enabled: false })
    let createCalled = 0
    deps.createUser = async (input) => {
      createCalled += 1
      createdUsers.push(input)
      return { id: 'should-not-exist' }
    }

    const door = await inviteOnboardingPerson(
      { name: 'Blocked', email: 'blocked@example.test' },
      deps,
    )

    assert.deepEqual(door, { ok: false, reason: 'disabled' })
    assert.equal(createCalled, 0)
    assert.equal(createdUsers.length, 0)
    assert.equal(mailLogs.length, 0)
    assert.equal(emits.length, 0)
  })
})

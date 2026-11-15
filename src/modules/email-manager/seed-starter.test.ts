/**
 * seedEmailStarter control flow — Events admin seed and Subscriptions starters.
 * Fakes stand in for the store. No database.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  runSeedEmailStarter,
  type EmailStarterSeedDeps,
  type EmailStarterWriteResult,
  type SeedEmailStarterInput,
} from './seed-starter'

const input: SeedEmailStarterInput = {
  template: {
    id: 'tpl-1',
    label: 'Template',
    moduleCategory: 'events',
    subject: 'Subject',
    bodyText: 'Body',
  },
  rule: {
    id: 'rule-1',
    label: 'Rule',
    moduleCategory: 'events',
    enabled: true,
    triggerKey: 'product:events/registered',
    mode: 'automatic',
    conditions: { all: [] },
    audience: { toFromPayload: ['respondentEmail'] },
    templateId: 'tpl-1',
  },
}

type Call = string

function harness(overrides: Partial<EmailStarterSeedDeps> = {}): {
  deps: EmailStarterSeedDeps
  calls: Call[]
} {
  const calls: Call[] = []
  const ok = async (): Promise<EmailStarterWriteResult> => ({ ok: true })
  const deps: EmailStarterSeedDeps = {
    async findEmailTemplateById() {
      calls.push('findTemplate')
      return null
    },
    async findEmailRuleById() {
      calls.push('findRule')
      return null
    },
    async createEmailTemplate() {
      calls.push('createTemplate')
      return ok()
    },
    async updateEmailTemplate() {
      calls.push('updateTemplate')
      return ok()
    },
    async createEmailRule() {
      calls.push('createRule')
      return ok()
    },
    async updateEmailRule() {
      calls.push('updateRule')
      return ok()
    },
    ...overrides,
  }
  return { deps, calls }
}

describe('runSeedEmailStarter', () => {
  it('updates the template when create returns an error, then still writes the rule', async () => {
    const { deps, calls } = harness({
      async createEmailTemplate() {
        calls.push('createTemplate')
        return { error: 'duplicate template' }
      },
    })

    const result = await runSeedEmailStarter(input, deps)

    assert.deepEqual(result, { ok: true })
    assert.deepEqual(calls, ['createTemplate', 'updateTemplate', 'createRule'])
  })

  it('continues to the rule when the template update returns an error', async () => {
    const { deps, calls } = harness({
      async createEmailTemplate() {
        calls.push('createTemplate')
        return { error: 'duplicate template' }
      },
      async updateEmailTemplate() {
        calls.push('updateTemplate')
        return { error: 'template update failed' }
      },
    })

    const result = await runSeedEmailStarter(input, deps)

    assert.deepEqual(result, { ok: true })
    assert.deepEqual(calls, ['createTemplate', 'updateTemplate', 'createRule'])
  })

  it('updates the rule when create returns an error', async () => {
    const { deps, calls } = harness({
      async createEmailRule() {
        calls.push('createRule')
        return { error: 'duplicate rule' }
      },
    })

    const result = await runSeedEmailStarter(input, deps)

    assert.deepEqual(result, { ok: true })
    assert.deepEqual(calls, ['createTemplate', 'createRule', 'updateRule'])
  })

  it('ensure creates only a missing rule when the template already exists', async () => {
    const { deps, calls } = harness({
      async findEmailTemplateById() {
        calls.push('findTemplate')
        return { id: 'tpl-1' }
      },
    })

    const result = await runSeedEmailStarter({ ...input, mode: 'ensure' }, deps)

    assert.deepEqual(result, { ok: true })
    assert.deepEqual(calls, ['findTemplate', 'findRule', 'createRule'])
  })

  it('ensure creates only a missing template when the rule already exists', async () => {
    const { deps, calls } = harness({
      async findEmailRuleById() {
        calls.push('findRule')
        return { id: 'rule-1' }
      },
    })

    const result = await runSeedEmailStarter({ ...input, mode: 'ensure' }, deps)

    assert.deepEqual(result, { ok: true })
    assert.deepEqual(calls, ['findTemplate', 'createTemplate', 'findRule'])
  })

  it('ensure still attempts the rule when template create returns an error', async () => {
    const { deps, calls } = harness({
      async createEmailTemplate() {
        calls.push('createTemplate')
        return { error: 'template insert failed' }
      },
    })

    const result = await runSeedEmailStarter({ ...input, mode: 'ensure' }, deps)

    assert.deepEqual(result, { ok: true })
    assert.deepEqual(calls, ['findTemplate', 'createTemplate', 'findRule', 'createRule'])
  })

  it('propagates a thrown template create and does not write the rule', async () => {
    const { deps, calls } = harness({
      async createEmailTemplate() {
        calls.push('createTemplate')
        throw new Error('template create threw')
      },
    })

    await assert.rejects(runSeedEmailStarter(input, deps), /template create threw/)
    assert.deepEqual(calls, ['createTemplate'])
  })

  it('propagates a thrown template update and does not write the rule', async () => {
    const { deps, calls } = harness({
      async createEmailTemplate() {
        calls.push('createTemplate')
        return { error: 'duplicate template' }
      },
      async updateEmailTemplate() {
        calls.push('updateTemplate')
        throw new Error('template update threw')
      },
    })

    await assert.rejects(runSeedEmailStarter(input, deps), /template update threw/)
    assert.deepEqual(calls, ['createTemplate', 'updateTemplate'])
  })

  it('propagates a thrown rule create after the template succeeded', async () => {
    const { deps, calls } = harness({
      async createEmailRule() {
        calls.push('createRule')
        throw new Error('rule create threw')
      },
    })

    await assert.rejects(runSeedEmailStarter(input, deps), /rule create threw/)
    assert.deepEqual(calls, ['createTemplate', 'createRule'])
  })

  it('ensure propagates a thrown template create and does not write the rule', async () => {
    const { deps, calls } = harness({
      async createEmailTemplate() {
        calls.push('createTemplate')
        throw new Error('template create threw')
      },
    })

    await assert.rejects(
      runSeedEmailStarter({ ...input, mode: 'ensure' }, deps),
      /template create threw/,
    )
    assert.deepEqual(calls, ['findTemplate', 'createTemplate'])
  })
})

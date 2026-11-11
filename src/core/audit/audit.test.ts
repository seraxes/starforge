import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { userIsDeveloperAdmin } from '@/core/auth/developer-admin'

import {
  environmentSaveAudit,
  moduleOnOffAudit,
  normalizeAdminAuditInput,
  redirectImportAudit,
  userCmsAction,
  userDisabledAction,
  userRoleAction,
} from './entries'

describe('normalizeAdminAuditInput', () => {
  it('keeps a user-disable row that names the actor', () => {
    assert.deepEqual(
      normalizeAdminAuditInput({
        actorId: 'actor-1',
        action: userDisabledAction(true),
        target: { type: 'user', id: 'user-2' },
      }),
      {
        actorId: 'actor-1',
        action: 'user.disable',
        targetType: 'user',
        targetId: 'user-2',
      },
    )
  })

  it('rejects secret-shaped values without echoing them', () => {
    assert.throws(
      () =>
        normalizeAdminAuditInput({
          actorId: 'actor-1',
          action: 'environment.save',
          target: { type: 'environment', id: 'PAYLOAD_SECRET=hunter2' },
        }),
      /Invalid admin audit record\./,
    )
    assert.throws(
      () =>
        normalizeAdminAuditInput({
          actorId: 'actor-1',
          action: 'user.disable',
          target: { type: 'user', id: 'session-token-abc' },
        }),
      /Invalid admin audit record\./,
    )
  })
})

describe('environment save row', () => {
  it('records that a save happened and nothing else', () => {
    const entry = environmentSaveAudit()
    assert.deepEqual(entry, {
      action: 'environment.save',
      target: { type: 'environment', id: 'overlay' },
    })
    const packed = JSON.stringify(entry)
    assert.equal(packed.includes('PAYLOAD_SECRET'), false)
    assert.equal(packed.includes('BETTER_AUTH_SECRET'), false)
    assert.equal(packed.includes('BARION'), false)
    assert.equal(packed.includes('password'), false)
    assert.equal(packed.includes('='), false)
    assert.deepEqual(Object.keys(entry).sort(), ['action', 'target'])
    assert.deepEqual(Object.keys(entry.target).sort(), ['id', 'type'])
  })
})

describe('module and redirect audit keys', () => {
  it('one module toggle is one row', () => {
    assert.deepEqual(moduleOnOffAudit('product:events', false), {
      action: 'module.off',
      target: { type: 'module', id: 'product:events' },
    })
    assert.equal(moduleOnOffAudit('product:events', true)?.action, 'module.on')
    assert.equal(moduleOnOffAudit('not a module', true), null)
  })

  it('puts the CSV import count in the action key and the target id', () => {
    assert.deepEqual(redirectImportAudit(4), {
      action: 'redirect.import.4',
      target: { type: 'redirect', id: '4' },
    })
    assert.equal(redirectImportAudit(0), null)
    assert.equal(redirectImportAudit(1.5), null)
  })

  it('role and CMS keys stay closed', () => {
    assert.equal(userRoleAction('admin'), 'user.role.admin')
    assert.equal(userRoleAction('member'), 'user.role.member')
    assert.equal(userRoleAction('owner'), null)
    assert.equal(userCmsAction(true), 'user.cms.on')
    assert.equal(userCmsAction(false), 'user.cms.off')
  })
})

describe('audit page audience', () => {
  const admin = { role: 'admin', email: 'admin@starforge.local' }
  const member = { role: 'member', email: 'member@starforge.local' }

  it('a member cannot open it', () => {
    assert.equal(
      userIsDeveloperAdmin(member, {
        NODE_ENV: 'development',
        STARFORGE_DEVELOPER_ADMIN_EMAILS: '',
      }),
      false,
    )
  })

  it('an app admin who is not a developer-admin cannot open it', () => {
    assert.equal(
      userIsDeveloperAdmin(admin, {
        NODE_ENV: 'production',
        STARFORGE_DEVELOPER_ADMIN_EMAILS: 'other@starforge.local',
      }),
      false,
    )
    assert.equal(
      userIsDeveloperAdmin(admin, {
        NODE_ENV: 'production',
        STARFORGE_DEVELOPER_ADMIN_EMAILS: 'admin@starforge.local',
      }),
      true,
    )
  })
})

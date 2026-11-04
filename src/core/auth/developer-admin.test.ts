import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  emptyDeveloperAdminEmailsGrantAllAdmins,
  getDeveloperAdminEmails,
  userIsDeveloperAdmin,
} from './developer-admin'

describe('getDeveloperAdminEmails', () => {
  it('parses comma-separated emails', () => {
    assert.deepEqual(
      getDeveloperAdminEmails({
        STARFORGE_DEVELOPER_ADMIN_EMAILS: ' Ada@Example.com , bob@x.io ',
      }),
      ['ada@example.com', 'bob@x.io'],
    )
  })

  it('returns empty when unset', () => {
    assert.deepEqual(getDeveloperAdminEmails({}), [])
    assert.deepEqual(getDeveloperAdminEmails({ STARFORGE_DEVELOPER_ADMIN_EMAILS: '  ,' }), [])
  })
})

describe('emptyDeveloperAdminEmailsGrantAllAdmins', () => {
  it('is false in production (fail-closed)', () => {
    assert.equal(emptyDeveloperAdminEmailsGrantAllAdmins({ NODE_ENV: 'production' }), false)
  })

  it('is true outside production (local-friendly)', () => {
    assert.equal(emptyDeveloperAdminEmailsGrantAllAdmins({ NODE_ENV: 'development' }), true)
    assert.equal(emptyDeveloperAdminEmailsGrantAllAdmins({ NODE_ENV: 'test' }), true)
    assert.equal(emptyDeveloperAdminEmailsGrantAllAdmins({}), true)
  })
})

describe('userIsDeveloperAdmin', () => {
  const admin = { role: 'admin', email: 'admin@starforge.local' }
  const member = { role: 'member', email: 'member@starforge.local' }

  it('denies non-admins even when listed', () => {
    assert.equal(
      userIsDeveloperAdmin(member, {
        NODE_ENV: 'development',
        STARFORGE_DEVELOPER_ADMIN_EMAILS: 'member@starforge.local',
      }),
      false,
    )
  })

  it('fail-closed: empty list grants nobody in production', () => {
    assert.equal(
      userIsDeveloperAdmin(admin, {
        NODE_ENV: 'production',
        STARFORGE_DEVELOPER_ADMIN_EMAILS: '',
      }),
      false,
    )
  })

  it('local-friendly: empty list grants all app admins outside production', () => {
    assert.equal(
      userIsDeveloperAdmin(admin, {
        NODE_ENV: 'development',
        STARFORGE_DEVELOPER_ADMIN_EMAILS: '',
      }),
      true,
    )
    assert.equal(
      userIsDeveloperAdmin(member, {
        NODE_ENV: 'development',
        STARFORGE_DEVELOPER_ADMIN_EMAILS: '',
      }),
      false,
    )
  })

  it('matches allowlist when set (any NODE_ENV)', () => {
    assert.equal(
      userIsDeveloperAdmin(admin, {
        NODE_ENV: 'production',
        STARFORGE_DEVELOPER_ADMIN_EMAILS: 'admin@starforge.local',
      }),
      true,
    )
    assert.equal(
      userIsDeveloperAdmin(admin, {
        NODE_ENV: 'production',
        STARFORGE_DEVELOPER_ADMIN_EMAILS: 'other@example.com',
      }),
      false,
    )
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { CanInteractContext } from './interact'
import {
  DEFAULT_SOCIAL_MODULE_SETTINGS,
  actorMayCreateSocialEntity,
  decideSocialPackSettings,
  isGroupAtMemberCap,
} from './pack-settings'
import {
  createGroupMemory,
  decideCreateGroup,
  decideCreateGroupCategory,
  decideJoinGroup,
  inviteToGroupWithMail,
} from './groups'
import {
  createPageMemory,
  decideCreatePage,
  decideLikePage,
  decideSetPageVerified,
} from './pages'

function interactCtx(
  overrides: Partial<CanInteractContext> = {},
): CanInteractContext {
  return {
    isBlocked: false,
    actorHidden: false,
    otherHidden: false,
    actorBannedAt: null,
    otherBannedAt: null,
    ...overrides,
  }
}

describe('social groups / pages settings (slice 15d)', () => {
  it('accepts groups/pages pack settings and a valid category kind (success path)', () => {
    const saved = decideSocialPackSettings({
      ...DEFAULT_SOCIAL_MODULE_SETTINGS,
      allowGroups: true,
      groupWhoCanCreate: 'staff',
      groupsNeedApproval: true,
      defaultGroupJoinRule: 'closed',
      maxGroupMembers: 25,
      allowGroupDocuments: false,
      allowGroupAnnouncements: true,
      allowGroupJoinForm: false,
      allowPages: true,
      pageWhoCanCreate: 'members',
      pagesNeedApproval: false,
      allowPageLikes: true,
    })
    assert.equal(saved.ok, true)
    if (!saved.ok) return
    assert.equal(saved.settings.allowGroups, true)
    assert.equal(saved.settings.groupWhoCanCreate, 'staff')
    assert.equal(saved.settings.groupsNeedApproval, true)
    assert.equal(saved.settings.defaultGroupJoinRule, 'closed')
    assert.equal(saved.settings.maxGroupMembers, 25)
    assert.equal(saved.settings.allowGroupDocuments, false)
    assert.equal(saved.settings.allowGroupJoinForm, false)
    assert.equal(saved.settings.allowPages, true)
    assert.equal(saved.settings.pageWhoCanCreate, 'members')
    assert.equal(saved.settings.pagesNeedApproval, false)
    assert.equal(saved.settings.allowPageLikes, true)
    assert.equal(actorMayCreateSocialEntity('staff', false), false)
    assert.equal(actorMayCreateSocialEntity('staff', true), true)
    assert.equal(isGroupAtMemberCap(25, 25), true)
    assert.equal(isGroupAtMemberCap(24, 25), false)

    const mem = createGroupMemory({
      now: () => new Date('2026-11-21T00:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `cat-${++n}`
      })(),
    })
    const category = mem.createCategory({
      name: 'Teams',
      kind: 'team',
      slug: 'teams',
    })
    assert.equal(category.ok, true)
    if (!category.ok) return
    assert.equal(category.category.kind, 'team')

    const created = decideCreateGroup(
      {
        name: 'Alpha',
        categoryId: category.category.id,
        ownerUserId: 'alice',
      },
      {
        categoryExists: true,
        allowGroups: true,
        canCreate: true,
        groupsNeedApproval: false,
        defaultJoinRule: 'closed',
        now: new Date('2026-11-21T00:00:00.000Z'),
        newId: () => 'group-1',
      },
    )
    assert.equal(created.ok, true)
    if (!created.ok) return
    assert.equal(created.group.visibility, 'closed')
    assert.ok(created.group.verifiedAt)

    const page = decideCreatePage(
      { name: 'Shop', ownerUserId: 'alice' },
      {
        allowPages: true,
        canCreate: true,
        pagesNeedApproval: false,
        now: new Date('2026-11-21T00:00:00.000Z'),
        newId: () => 'page-1',
      },
    )
    assert.equal(page.ok, true)
    if (!page.ok) return
    assert.ok(page.page.verifiedAt)

    const verified = decideSetPageVerified(page.page, false, {
      now: new Date('2026-11-21T01:00:00.000Z'),
    })
    assert.equal(verified.ok, true)
    if (!verified.ok) return
    assert.equal(verified.page.verifiedAt, null)
  })

  it('refuses a category kind outside general, team, and association (failure path)', async () => {
    assert.deepEqual(
      decideCreateGroupCategory({ name: 'Clans', kind: 'clan' }),
      { ok: false, reason: 'invalid_kind' },
    )
    assert.deepEqual(
      decideCreateGroupCategory({ name: 'Fans', kind: 'fanclub', slug: 'fans' }),
      { ok: false, reason: 'invalid_kind' },
    )

    assert.deepEqual(
      decideCreateGroup(
        {
          name: 'Nope',
          categoryId: 'cat-1',
          ownerUserId: 'alice',
        },
        { allowGroups: false, categoryExists: true },
      ),
      { ok: false, reason: 'disabled' },
    )
    assert.deepEqual(
      decideCreateGroup(
        {
          name: 'Staff only',
          categoryId: 'cat-1',
          ownerUserId: 'alice',
        },
        { canCreate: false, categoryExists: true },
      ),
      { ok: false, reason: 'not_allowed' },
    )
    assert.deepEqual(
      decideJoinGroup(
        {
          id: 'g1',
          name: 'Full',
          slug: 'full',
          description: '',
          coverMediaId: null,
          categoryId: 'c1',
          visibility: 'open',
          ownerUserId: 'alice',
          formDefinitionId: null,
          verifiedAt: null,
          extensions: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        null,
        'bob',
        { activeMemberCount: 10, maxGroupMembers: 10 },
      ),
      { ok: false, reason: 'member_cap' },
    )

    assert.deepEqual(
      decideCreatePage(
        { name: 'Off', ownerUserId: 'alice' },
        { allowPages: false },
      ),
      { ok: false, reason: 'disabled' },
    )

    const pages = createPageMemory({
      now: () => new Date('2026-11-21T00:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `p-${++n}`
      })(),
    })
    const made = pages.createPage({ name: 'Brand', ownerUserId: 'alice' })
    assert.equal(made.ok, true)
    if (!made.ok) return
    assert.deepEqual(
      decideLikePage(made.page, null, { pageId: made.page.id, userId: 'bob' }, {
        allowPageLikes: false,
      }),
      { ok: false, reason: 'disabled' },
    )

    // Blocked-user case on a relationship write (group invite).
    const groups = createGroupMemory({
      now: () => new Date('2026-11-21T00:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `g-${++n}`
      })(),
    })
    const cat = groups.createCategory({ name: 'General', kind: 'general' })
    assert.equal(cat.ok, true)
    if (!cat.ok) return
    const group = groups.createGroup({
      name: 'Ops',
      categoryId: cat.category.id,
      ownerUserId: 'alice',
      visibility: 'closed',
    })
    assert.equal(group.ok, true)
    if (!group.ok) return
    const inviteInput = {
      groupId: group.group.id,
      actorUserId: 'alice',
      inviteeUserId: 'bob',
      interact: interactCtx({ isBlocked: true }),
    }
    assert.deepEqual(groups.invite(inviteInput), { ok: false, reason: 'blocked' })
    assert.deepEqual(
      await inviteToGroupWithMail(
        () => groups.invite(inviteInput),
        async () => undefined,
      ),
      { ok: false, reason: 'blocked' },
    )
  })
})

import { VISITORS_GROUP_ID } from '@/core/acl/nav-access'
import { MODULE_IDS } from '@/core/settings/module-toggles'

import { createNavMenuItem } from './document'
import type { NavMenuItem } from './types'

/** Navigation menu the account particle renders when a slot has no other menu. */
export const ACCOUNT_NAV_MENU_ID = 'account'

/**
 * Starter items for the Account navigation menu.
 * Signed-out rows use the Visitors group; signed-in rows use `registered`.
 * Module links disappear while that module is off.
 * Edit the live copy under Navigation — this list is inserted only when the menu row is missing.
 */
export function accountNavMenuSeedItems(): NavMenuItem[] {
  return [
    createNavMenuItem(
      {
        id: 'account-sign-in',
        label: 'Sign in',
        labels: { hu: 'Bejelentkezés' },
        linkType: 'url',
        url: '/login',
        accessTags: [`group:${VISITORS_GROUP_ID}`],
      },
      0,
    ),
    createNavMenuItem(
      {
        id: 'account-register',
        label: 'Create account',
        labels: { hu: 'Fiók létrehozása' },
        linkType: 'module',
        moduleId: MODULE_IDS.registration,
        moduleViewKey: 'register',
        accessTags: [`group:${VISITORS_GROUP_ID}`],
      },
      1,
    ),
    createNavMenuItem(
      {
        id: 'account-plans',
        label: 'Plans',
        labels: { hu: 'Csomagok' },
        linkType: 'module',
        moduleId: MODULE_IDS.subscriptions,
        moduleViewKey: 'catalog',
        accessTags: [`group:${VISITORS_GROUP_ID}`],
      },
      2,
    ),
    createNavMenuItem(
      {
        id: 'account-home',
        label: 'Account',
        labels: { hu: 'Fiók' },
        linkType: 'module',
        moduleId: MODULE_IDS.profiles,
        moduleViewKey: 'account',
        accessTags: ['registered'],
      },
      3,
    ),
    createNavMenuItem(
      {
        id: 'account-security',
        label: 'Account security',
        labels: { hu: 'Fiók biztonsága' },
        linkType: 'url',
        url: '/account/security',
        accessTags: ['registered'],
      },
      4,
    ),
    createNavMenuItem(
      {
        id: 'account-subscriptions',
        label: 'My subscriptions',
        labels: { hu: 'Előfizetéseim' },
        linkType: 'module',
        moduleId: MODULE_IDS.subscriptions,
        moduleViewKey: 'account',
        accessTags: ['registered'],
      },
      5,
    ),
  ]
}

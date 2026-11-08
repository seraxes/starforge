import 'server-only'

import { eq } from 'drizzle-orm'

import { requireAdminArea } from '@/core/acl/access'
import { userIsAppAdmin } from '@/core/auth/admin'
import { db } from '@/core/db'

import { sfPayCollectEntitlements } from './schema'

/**
 * Subscription stub + ACL for premium collect.
 * Later: product:subscriptions replaces sf_pay_collect_entitlements.
 */

export async function hasCollectCapability(userId: string): Promise<boolean> {
  const id = userId.trim()
  if (!id) return false
  try {
    const rows = await db
      .select()
      .from(sfPayCollectEntitlements)
      .where(eq(sfPayCollectEntitlements.userId, id))
      .limit(1)
    return Boolean(rows[0]?.canCollectPayments)
  } catch {
    return false
  }
}

export async function grantCollectCapability(
  userId: string,
  source = 'stub',
): Promise<void> {
  const id = userId.trim()
  if (!id) return
  await db
    .insert(sfPayCollectEntitlements)
    .values({ userId: id, canCollectPayments: true, source })
    .onConflictDoUpdate({
      target: sfPayCollectEntitlements.userId,
      set: { canCollectPayments: true, source, updatedAt: new Date() },
    })
}

/**
 * User may manage merchant collect for `userId` when:
 * - signed in with ACL `admin.payments-merchant` (app admins always pass), and
 * - target is self (or actor is app admin), and
 * - collect entitlement is on (auto-grant stub after ACL for self until subscriptions ship).
 */
export async function assertMayCollect(
  userId: string,
): Promise<{ ok: true; actorUserId: string } | { ok: false; error: string }> {
  const session = await requireAdminArea('admin.payments-merchant')
  if (!session?.user?.id) {
    return {
      ok: false,
      error: 'Sign in with Merchant payments access (ACL → Payments merchant).',
    }
  }

  const actorId = session.user.id
  const appAdmin = userIsAppAdmin(session.user)
  if (actorId !== userId.trim() && !appAdmin) {
    return { ok: false, error: 'You may only manage your own merchant profile.' }
  }

  const target = userId.trim() || actorId
  let capable = await hasCollectCapability(target)
  if (!capable) {
    // Stub until product:subscriptions: ACL grant implies collect for self.
    if (target === actorId || appAdmin) {
      await grantCollectCapability(target, appAdmin ? 'admin-stub' : 'acl-stub')
      capable = true
    }
  }
  if (!capable) {
    return {
      ok: false,
      error: 'Premium collect is not enabled for this account (subscription required).',
    }
  }
  return { ok: true, actorUserId: actorId }
}

/**
 * Member-audience slot.
 *
 * Events quotes a member ticket price without importing Subscriptions
 * (advanced must not import advanced). Subscriptions boot registers the
 * resolver. When Subscriptions is off or has not booted, the slot is empty
 * and member pricing does not apply.
 *
 * `events.member` is the stable key `ENTITLEMENT_KEYS.eventsMember`.
 */

export const EVENTS_MEMBER_ENTITLEMENT = 'events.member'

export type MemberAudience = {
  entitlementKeys: string[]
  groupIds: string[]
}

type MemberAudienceResolver = (userId: string) => Promise<MemberAudience>

let resolver: MemberAudienceResolver | null = null

export function registerMemberAudienceResolver(fn: MemberAudienceResolver): void {
  resolver = fn
}

export async function resolveMemberAudience(userId: string): Promise<MemberAudience> {
  if (!resolver) return { entitlementKeys: [], groupIds: [] }
  try {
    return await resolver(userId)
  } catch {
    return { entitlementKeys: [], groupIds: [] }
  }
}

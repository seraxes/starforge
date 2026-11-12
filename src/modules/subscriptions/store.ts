/**
 * Plans + periods CRUD and entitlement resolve.
 */

import 'server-only'

import { and, asc, desc, eq, inArray, lte, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/core/db'

import { sfSubPeriods, sfSubPlans } from './schema'
import {
  defaultEntitlementKeysForSubject,
  isPlanBillingPeriod,
  type AudienceResolve,
  type PeriodStatus,
  type PlanBillingPeriod,
  type SubscriptionPeriodRecord,
  type SubscriptionPlanRecord,
} from './types'

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`
}

function asStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    const s = String(item ?? '').trim()
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}

function mapPlan(row: typeof sfSubPlans.$inferSelect): SubscriptionPlanRecord {
  const billingPeriod: PlanBillingPeriod = isPlanBillingPeriod(row.billingPeriod)
    ? row.billingPeriod
    : 'month'
  return {
    id: row.id,
    subject: row.subject?.trim() || 'membership',
    audience: row.audience ?? '',
    title: row.title?.trim() || 'Plan',
    description: row.description ?? '',
    price:
      typeof row.price === 'number' && Number.isFinite(row.price) ? Math.floor(row.price) : 0,
    billingPeriod,
    entitlementKeys: asStringList(row.entitlementKeys),
    groupIds: asStringList(row.groupIds),
    sourceModule: row.sourceModule ?? '',
    sourceType: row.sourceType ?? '',
    sourceId: row.sourceId ?? '',
    active: row.active !== false,
    sortOrder:
      typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder)
        ? Math.floor(row.sortOrder)
        : 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapPeriod(row: typeof sfSubPeriods.$inferSelect): SubscriptionPeriodRecord {
  const status: PeriodStatus =
    row.status === 'expired' || row.status === 'refunded' ? row.status : 'active'
  const billingPeriod: PlanBillingPeriod = isPlanBillingPeriod(row.billingPeriod)
    ? row.billingPeriod
    : 'month'
  return {
    id: row.id,
    planId: row.planId,
    userId: row.userId,
    status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    orderId: row.orderId ?? null,
    subject: row.subject?.trim() || 'membership',
    audience: row.audience ?? '',
    billingPeriod,
    entitlementKeys: asStringList(row.entitlementKeys),
    groupIds: asStringList(row.groupIds),
    sourceModule: row.sourceModule ?? '',
    sourceType: row.sourceType ?? '',
    sourceId: row.sourceId ?? '',
    source: row.source ?? 'purchase',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function parsePrice(raw: unknown): number {
  if (raw == null || raw === '') return 0
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

function parseKeysField(raw: unknown): string[] {
  if (Array.isArray(raw)) return asStringList(raw)
  const s = String(raw ?? '').trim()
  if (!s) return []
  return asStringList(s.split(/[\n,]+/))
}

export function addBillingPeriod(from: Date, period: PlanBillingPeriod): Date {
  const next = new Date(from.getTime())
  if (period === 'year') {
    next.setUTCFullYear(next.getUTCFullYear() + 1)
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1)
  }
  return next
}

export async function listPlans(opts?: {
  subject?: string
  activeOnly?: boolean
}): Promise<SubscriptionPlanRecord[]> {
  try {
    const rows = await db.select().from(sfSubPlans).orderBy(asc(sfSubPlans.sortOrder), asc(sfSubPlans.title))
    let plans = rows.map(mapPlan)
    const subject = (opts?.subject || '').trim()
    if (subject) plans = plans.filter((p) => p.subject === subject)
    if (opts?.activeOnly) plans = plans.filter((p) => p.active)
    return plans
  } catch {
    return []
  }
}

export async function findPlanById(id: string): Promise<SubscriptionPlanRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const rows = await db.select().from(sfSubPlans).where(eq(sfSubPlans.id, trimmed)).limit(1)
    return rows[0] ? mapPlan(rows[0]) : null
  } catch {
    return null
  }
}

export type SavePlanInput = {
  id?: string
  subject: string
  audience?: string
  title: string
  description?: string
  price: unknown
  billingPeriod: unknown
  entitlementKeys?: unknown
  groupIds?: unknown
  sourceModule?: string
  sourceType?: string
  sourceId?: string
  active?: boolean
  sortOrder?: unknown
}

export async function createPlan(
  input: SavePlanInput,
): Promise<{ ok: true; plan: SubscriptionPlanRecord } | { ok: false; error: string }> {
  const subject = String(input.subject ?? '').trim() || 'membership'
  const title = String(input.title ?? '').trim()
  if (!title) return { ok: false, error: 'Title is required.' }
  const billingPeriod: PlanBillingPeriod = isPlanBillingPeriod(input.billingPeriod)
    ? input.billingPeriod
    : 'month'
  let entitlementKeys = parseKeysField(input.entitlementKeys)
  if (entitlementKeys.length === 0) {
    entitlementKeys = defaultEntitlementKeysForSubject(subject)
  }
  const id = newId('splan')
  const sortOrder =
    typeof input.sortOrder === 'number' && Number.isFinite(input.sortOrder)
      ? Math.floor(input.sortOrder)
      : Number(String(input.sortOrder ?? '').trim()) || 0
  try {
    await db.insert(sfSubPlans).values({
      id,
      subject,
      audience: String(input.audience ?? '').trim(),
      title,
      description: String(input.description ?? '').trim(),
      price: parsePrice(input.price),
      billingPeriod,
      entitlementKeys,
      groupIds: parseKeysField(input.groupIds),
      sourceModule: String(input.sourceModule ?? '').trim(),
      sourceType: String(input.sourceType ?? '').trim(),
      sourceId: String(input.sourceId ?? '').trim(),
      active: input.active !== false,
      sortOrder,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_sub_plans|does not exist|relation/i.test(msg)) {
      return { ok: false, error: 'sf_sub_plans missing — run npm run db:migrate.' }
    }
    return { ok: false, error: msg }
  }
  const plan = await findPlanById(id)
  if (!plan) return { ok: false, error: 'Plan create failed.' }
  return { ok: true, plan }
}

export async function updatePlan(
  input: SavePlanInput & { id: string },
): Promise<{ ok: true; plan: SubscriptionPlanRecord } | { ok: false; error: string }> {
  const id = input.id.trim()
  if (!id) return { ok: false, error: 'Missing plan id.' }
  const existing = await findPlanById(id)
  if (!existing) return { ok: false, error: 'Plan not found.' }
  const subject = String(input.subject ?? existing.subject).trim() || 'membership'
  const title = String(input.title ?? existing.title).trim()
  if (!title) return { ok: false, error: 'Title is required.' }
  const billingPeriod: PlanBillingPeriod = isPlanBillingPeriod(input.billingPeriod)
    ? input.billingPeriod
    : existing.billingPeriod
  let entitlementKeys = parseKeysField(input.entitlementKeys)
  if (entitlementKeys.length === 0) {
    entitlementKeys = defaultEntitlementKeysForSubject(subject)
  }
  const sortOrder =
    input.sortOrder == null || input.sortOrder === ''
      ? existing.sortOrder
      : Number(String(input.sortOrder).trim()) || 0
  try {
    await db
      .update(sfSubPlans)
      .set({
        subject,
        audience: String(input.audience ?? existing.audience).trim(),
        title,
        description: String(input.description ?? existing.description).trim(),
        price: parsePrice(input.price ?? existing.price),
        billingPeriod,
        entitlementKeys,
        groupIds: parseKeysField(input.groupIds ?? existing.groupIds),
        sourceModule: String(input.sourceModule ?? existing.sourceModule).trim(),
        sourceType: String(input.sourceType ?? existing.sourceType).trim(),
        sourceId: String(input.sourceId ?? existing.sourceId).trim(),
        active: input.active !== false,
        sortOrder: Math.floor(sortOrder),
        updatedAt: new Date(),
      })
      .where(eq(sfSubPlans.id, id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, error: msg }
  }
  const plan = await findPlanById(id)
  if (!plan) return { ok: false, error: 'Plan update failed.' }
  return { ok: true, plan }
}

export async function setPlanActive(
  id: string,
  active: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { ok: false, error: 'Missing plan id.' }
  try {
    await db
      .update(sfSubPlans)
      .set({ active: Boolean(active), updatedAt: new Date() })
      .where(eq(sfSubPlans.id, trimmed))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, error: msg }
  }
  return { ok: true }
}

export async function listPeriods(opts?: {
  userId?: string
  planId?: string
  status?: PeriodStatus | PeriodStatus[]
  limit?: number
}): Promise<SubscriptionPeriodRecord[]> {
  try {
    const filters = []
    const userId = (opts?.userId || '').trim()
    if (userId) filters.push(eq(sfSubPeriods.userId, userId))
    const planId = (opts?.planId || '').trim()
    if (planId) filters.push(eq(sfSubPeriods.planId, planId))
    if (opts?.status) {
      const statuses = Array.isArray(opts.status) ? opts.status : [opts.status]
      filters.push(inArray(sfSubPeriods.status, statuses))
    }
    const rows = await db
      .select()
      .from(sfSubPeriods)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(sfSubPeriods.createdAt))
      .limit(Math.min(Math.max(opts?.limit ?? 200, 1), 500))
    return rows.map(mapPeriod)
  } catch {
    return []
  }
}

export async function listActivePeriodsForUser(
  userId: string,
  now = new Date(),
): Promise<SubscriptionPeriodRecord[]> {
  const id = userId.trim()
  if (!id) return []
  try {
    const rows = await db
      .select()
      .from(sfSubPeriods)
      .where(and(eq(sfSubPeriods.userId, id), eq(sfSubPeriods.status, 'active')))
    return rows
      .map(mapPeriod)
      .filter((p) => p.endsAt.getTime() > now.getTime() && p.startsAt.getTime() <= now.getTime())
  } catch {
    return []
  }
}

export async function resolveAudience(
  userId: string,
  now = new Date(),
): Promise<AudienceResolve> {
  try {
    const { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } = await import(
      '@/core/settings'
    )
    const settings = await getSiteSettings()
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)) {
      return { entitlementKeys: [], groupIds: [], periodIds: [] }
    }
  } catch {
    return { entitlementKeys: [], groupIds: [], periodIds: [] }
  }
  const periods = await listActivePeriodsForUser(userId, now)
  const entitlementKeys: string[] = []
  const groupIds: string[] = []
  const periodIds: string[] = []
  for (const p of periods) {
    periodIds.push(p.id)
    for (const k of p.entitlementKeys) {
      if (!entitlementKeys.includes(k)) entitlementKeys.push(k)
    }
    for (const g of p.groupIds) {
      if (!groupIds.includes(g)) groupIds.push(g)
    }
  }
  return { entitlementKeys, groupIds, periodIds }
}

export async function hasEntitlement(
  userId: string,
  key: string,
  now = new Date(),
): Promise<boolean> {
  const k = key.trim()
  if (!k) return false
  try {
    const { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } = await import(
      '@/core/settings'
    )
    const settings = await getSiteSettings()
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)) return false
  } catch {
    return false
  }
  const audience = await resolveAudience(userId, now)
  return audience.entitlementKeys.includes(k)
}

export async function hasActiveSubject(
  userId: string,
  sourceModule: string,
  sourceType: string,
  sourceId: string,
  now = new Date(),
): Promise<boolean> {
  const mod = sourceModule.trim()
  const typ = sourceType.trim()
  const sid = sourceId.trim()
  if (!mod || !typ || !sid) return false
  const periods = await listActivePeriodsForUser(userId, now)
  return periods.some(
    (p) => p.sourceModule === mod && p.sourceType === typ && p.sourceId === sid,
  )
}

export type ActivatePeriodInput = {
  planId: string
  userId: string
  orderId?: string | null
  source?: string
  /** Snapshot overrides from checkout metadata. */
  subject?: string
  audience?: string
  billingPeriod?: PlanBillingPeriod
  entitlementKeys?: string[]
  groupIds?: string[]
  sourceModule?: string
  sourceType?: string
  sourceId?: string
  now?: Date
}

/**
 * Open or extend an active period for the same plan.
 * Extension starts from the later of now and current endsAt.
 */
export async function activateOrExtendPeriod(
  input: ActivatePeriodInput,
): Promise<{ ok: true; period: SubscriptionPeriodRecord } | { ok: false; error: string }> {
  const planId = input.planId.trim()
  const userId = input.userId.trim()
  if (!planId || !userId) return { ok: false, error: 'Missing plan or user.' }

  const plan = await findPlanById(planId)
  if (!plan && !input.subject) return { ok: false, error: 'Plan not found.' }

  const now = input.now ?? new Date()
  const billingPeriod: PlanBillingPeriod =
    input.billingPeriod && isPlanBillingPeriod(input.billingPeriod)
      ? input.billingPeriod
      : plan?.billingPeriod || 'month'
  const subject = (input.subject || plan?.subject || 'membership').trim()
  const audience = (input.audience ?? plan?.audience ?? '').trim()
  const entitlementKeys =
    input.entitlementKeys && input.entitlementKeys.length > 0
      ? asStringList(input.entitlementKeys)
      : plan?.entitlementKeys?.length
        ? plan.entitlementKeys
        : defaultEntitlementKeysForSubject(subject)
  const groupIds = input.groupIds ?? plan?.groupIds ?? []
  const sourceModule = (input.sourceModule ?? plan?.sourceModule ?? '').trim()
  const sourceType = (input.sourceType ?? plan?.sourceType ?? '').trim()
  const sourceId = (input.sourceId ?? plan?.sourceId ?? '').trim()

  try {
    const orderId = (input.orderId || '').trim() || null
    // Idempotent paid webhook — same order must not extend twice.
    if (orderId) {
      const already = await db
        .select()
        .from(sfSubPeriods)
        .where(eq(sfSubPeriods.orderId, orderId))
        .limit(1)
      if (already[0]) {
        return { ok: true, period: mapPeriod(already[0]) }
      }
    }

    const existing = await db
      .select()
      .from(sfSubPeriods)
      .where(
        and(
          eq(sfSubPeriods.userId, userId),
          eq(sfSubPeriods.planId, planId),
          eq(sfSubPeriods.status, 'active'),
        ),
      )
      .orderBy(desc(sfSubPeriods.endsAt))
      .limit(1)

    const current = existing[0] ? mapPeriod(existing[0]) : null
    if (current && current.endsAt.getTime() > now.getTime()) {
      const base = current.endsAt.getTime() > now.getTime() ? current.endsAt : now
      const endsAt = addBillingPeriod(base, billingPeriod)
      // Keep the latest order id for refunds; earlier extensions stay on the period.
      await db
        .update(sfSubPeriods)
        .set({
          endsAt,
          orderId: orderId ?? current.orderId,
          entitlementKeys,
          groupIds: asStringList(groupIds),
          subject,
          audience,
          billingPeriod,
          sourceModule,
          sourceType,
          sourceId,
          updatedAt: new Date(),
        })
        .where(eq(sfSubPeriods.id, current.id))
      const updated = await db
        .select()
        .from(sfSubPeriods)
        .where(eq(sfSubPeriods.id, current.id))
        .limit(1)
      return { ok: true, period: mapPeriod(updated[0]!) }
    }

    const id = newId('speriod')
    const startsAt = now
    const endsAt = addBillingPeriod(startsAt, billingPeriod)
    await db.insert(sfSubPeriods).values({
      id,
      planId,
      userId,
      status: 'active',
      startsAt,
      endsAt,
      orderId,
      subject,
      audience,
      billingPeriod,
      entitlementKeys,
      groupIds: asStringList(groupIds),
      sourceModule,
      sourceType,
      sourceId,
      source: input.source || 'purchase',
    })
    const rows = await db.select().from(sfSubPeriods).where(eq(sfSubPeriods.id, id)).limit(1)
    return { ok: true, period: mapPeriod(rows[0]!) }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_sub_periods|does not exist|relation/i.test(msg)) {
      return { ok: false, error: 'sf_sub_periods missing — run npm run db:migrate.' }
    }
    return { ok: false, error: msg }
  }
}

export async function endPeriodsForOrder(
  orderId: string,
  status: 'expired' | 'refunded',
): Promise<number> {
  const id = orderId.trim()
  if (!id) return 0
  try {
    const result = await db
      .update(sfSubPeriods)
      .set({ status, updatedAt: new Date(), endsAt: new Date() })
      .where(and(eq(sfSubPeriods.orderId, id), eq(sfSubPeriods.status, 'active')))
      .returning({ id: sfSubPeriods.id })
    return result.length
  } catch {
    return 0
  }
}

/** Mark active periods past endsAt as expired. */
export async function expireLapsedPeriods(now = new Date()): Promise<number> {
  try {
    const result = await db
      .update(sfSubPeriods)
      .set({ status: 'expired', updatedAt: now })
      .where(and(eq(sfSubPeriods.status, 'active'), lte(sfSubPeriods.endsAt, now)))
      .returning({ id: sfSubPeriods.id })
    return result.length
  } catch {
    return 0
  }
}

export async function adminCompPeriod(input: {
  planId: string
  userId: string
}): Promise<{ ok: true; period: SubscriptionPeriodRecord } | { ok: false; error: string }> {
  return activateOrExtendPeriod({
    planId: input.planId,
    userId: input.userId,
    source: 'admin_comp',
  })
}

export async function countActiveSubscribers(): Promise<number> {
  try {
    const rows = await db
      .select({ n: sql<number>`count(distinct ${sfSubPeriods.userId})::int` })
      .from(sfSubPeriods)
      .where(eq(sfSubPeriods.status, 'active'))
    return Number(rows[0]?.n ?? 0)
  } catch {
    return 0
  }
}

export async function listPlansByIds(ids: string[]): Promise<SubscriptionPlanRecord[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  if (unique.length === 0) return []
  try {
    const rows = await db.select().from(sfSubPlans).where(inArray(sfSubPlans.id, unique))
    return rows.map(mapPlan)
  } catch {
    return []
  }
}

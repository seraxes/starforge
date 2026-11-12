/**
 * Plans + periods CRUD and entitlement resolve.
 */

import 'server-only'

import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/core/db'

import { sfSubPeriods, sfSubPlans, sfSubSeats } from './schema'
import {
  addBillingPeriod,
  periodEffectiveEnd,
  subtractBillingPeriod,
} from './lifecycle-math'
import {
  defaultEntitlementKeysForSubject,
  isPlanBillingPeriod,
  type AudienceResolve,
  type PeriodStatus,
  type PlanBillingPeriod,
  type SubscriptionPeriodRecord,
  type SubscriptionPlanRecord,
  type SubscriptionSeatRecord,
} from './types'

export {
  addBillingPeriod,
  billingPeriodDurationMs,
  computeUpgradeCreditMajor,
  periodEffectiveEnd,
  subtractBillingPeriod,
} from './lifecycle-math'

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

function parseKeysField(raw: unknown): string[] {
  if (Array.isArray(raw)) return asStringList(raw)
  const s = String(raw ?? '').trim()
  if (!s) return []
  return asStringList(s.split(/[\n,]+/))
}

function parsePrice(raw: unknown): number {
  if (raw == null || raw === '') return 0
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

function parseNonNegInt(raw: unknown, fallback = 0): number {
  if (raw == null || raw === '') return fallback
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}

function parseOptionalPrice(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  return parsePrice(raw)
}

function parseOptionalDate(raw: unknown): Date | null {
  if (raw == null || raw === '') return null
  if (raw instanceof Date && Number.isFinite(raw.getTime())) return raw
  const s = String(raw).trim()
  if (!s) return null
  const d = new Date(s.includes('T') ? s : `${s}T23:59:59.999Z`)
  return Number.isFinite(d.getTime()) ? d : null
}

function mapPlan(row: typeof sfSubPlans.$inferSelect): SubscriptionPlanRecord {
  const billingPeriod: PlanBillingPeriod = isPlanBillingPeriod(row.billingPeriod)
    ? row.billingPeriod
    : row.lifetime
      ? 'lifetime'
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
    trialDurationDays: parseNonNegInt(row.trialDurationDays, 0),
    trialPrice: parseNonNegInt(row.trialPrice, 0),
    trialOnce: row.trialOnce !== false,
    lifetime: row.lifetime === true || billingPeriod === 'lifetime',
    fixedExpiresAt: row.fixedExpiresAt ?? null,
    maxActive: parseNonNegInt(row.maxActive, 0),
    formDefinitionId: row.formDefinitionId ?? '',
    earlyRenewDays: parseNonNegInt(row.earlyRenewDays, 0),
    earlyRenewPrice:
      row.earlyRenewPrice == null ? null : parseNonNegInt(row.earlyRenewPrice, 0),
    upgradeTargetIds: asStringList(row.upgradeTargetIds),
    graceHours: parseNonNegInt(row.graceHours, 0),
    seatLimit: parseNonNegInt(row.seatLimit, 0),
    recurringSupported: row.recurringSupported === true,
    imageMediaId: row.imageMediaId ?? '',
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
    cancelAtPeriodEnd: row.cancelAtPeriodEnd === true,
    autoRenew: row.autoRenew === true,
    paymentsRecurringId: row.paymentsRecurringId ?? null,
    isTrial: row.isTrial === true,
    parentPeriodId: row.parentPeriodId ?? null,
    seatRole: row.seatRole ?? '',
    reminderExpiringSentAt: row.reminderExpiringSentAt ?? null,
    reminderTrialSentAt: row.reminderTrialSentAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapSeat(row: typeof sfSubSeats.$inferSelect): SubscriptionSeatRecord {
  return {
    id: row.id,
    periodId: row.periodId,
    userId: row.userId,
    role: row.role === 'admin' ? 'admin' : 'member',
    createdAt: row.createdAt,
  }
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
  trialDurationDays?: unknown
  trialPrice?: unknown
  trialOnce?: boolean
  lifetime?: boolean
  fixedExpiresAt?: unknown
  maxActive?: unknown
  formDefinitionId?: string
  earlyRenewDays?: unknown
  earlyRenewPrice?: unknown
  upgradeTargetIds?: unknown
  graceHours?: unknown
  seatLimit?: unknown
  recurringSupported?: boolean
  imageMediaId?: string
  titleLocales?: Record<string, string>
  descriptionLocales?: Record<string, string>
}

function planValuesFromInput(input: SavePlanInput, existing?: SubscriptionPlanRecord) {
  const subject = String(input.subject ?? existing?.subject ?? 'membership').trim() || 'membership'
  const title = String(input.title ?? existing?.title ?? '').trim()
  let billingPeriod: PlanBillingPeriod = isPlanBillingPeriod(input.billingPeriod)
    ? input.billingPeriod
    : existing?.billingPeriod || 'month'
  const lifetime =
    input.lifetime === true || billingPeriod === 'lifetime' || existing?.lifetime === true
  if (lifetime) billingPeriod = 'lifetime'
  let entitlementKeys = parseKeysField(input.entitlementKeys)
  if (entitlementKeys.length === 0) {
    entitlementKeys = existing?.entitlementKeys?.length
      ? existing.entitlementKeys
      : defaultEntitlementKeysForSubject(subject)
  }
  const sortOrder =
    input.sortOrder == null || input.sortOrder === ''
      ? existing?.sortOrder ?? 0
      : Number(String(input.sortOrder).trim()) || 0
  return {
    subject,
    title,
    audience: String(input.audience ?? existing?.audience ?? '').trim(),
    description: String(input.description ?? existing?.description ?? '').trim(),
    price: parsePrice(input.price ?? existing?.price ?? 0),
    billingPeriod,
    entitlementKeys,
    groupIds:
      input.groupIds !== undefined
        ? parseKeysField(input.groupIds)
        : (existing?.groupIds ?? []),
    sourceModule: String(input.sourceModule ?? existing?.sourceModule ?? '').trim(),
    sourceType: String(input.sourceType ?? existing?.sourceType ?? '').trim(),
    sourceId: String(input.sourceId ?? existing?.sourceId ?? '').trim(),
    active: input.active !== false,
    sortOrder: Math.floor(sortOrder),
    trialDurationDays: parseNonNegInt(input.trialDurationDays ?? existing?.trialDurationDays, 0),
    trialPrice: parseNonNegInt(input.trialPrice ?? existing?.trialPrice, 0),
    trialOnce:
      input.trialOnce !== undefined
        ? Boolean(input.trialOnce)
        : existing?.trialOnce !== false,
    lifetime,
    fixedExpiresAt: parseOptionalDate(
      input.fixedExpiresAt !== undefined ? input.fixedExpiresAt : existing?.fixedExpiresAt,
    ),
    maxActive: parseNonNegInt(input.maxActive ?? existing?.maxActive, 0),
    formDefinitionId: String(input.formDefinitionId ?? existing?.formDefinitionId ?? '').trim(),
    earlyRenewDays: parseNonNegInt(input.earlyRenewDays ?? existing?.earlyRenewDays, 0),
    earlyRenewPrice: parseOptionalPrice(
      input.earlyRenewPrice !== undefined ? input.earlyRenewPrice : existing?.earlyRenewPrice,
    ),
    upgradeTargetIds: parseKeysField(input.upgradeTargetIds ?? existing?.upgradeTargetIds),
    graceHours: parseNonNegInt(input.graceHours ?? existing?.graceHours, 0),
    seatLimit: parseNonNegInt(input.seatLimit ?? existing?.seatLimit, 0),
    recurringSupported:
      input.recurringSupported === true ||
      (input.recurringSupported === undefined && existing?.recurringSupported === true),
    imageMediaId: String(input.imageMediaId ?? existing?.imageMediaId ?? '').trim(),
  }
}

export async function createPlan(
  input: SavePlanInput,
): Promise<{ ok: true; plan: SubscriptionPlanRecord } | { ok: false; error: string }> {
  const values = planValuesFromInput(input)
  if (!values.title) return { ok: false, error: 'Title is required.' }
  const id = newId('splan')
  try {
    await db.insert(sfSubPlans).values({ id, ...values })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_sub_plans|does not exist|relation/i.test(msg)) {
      return { ok: false, error: 'sf_sub_plans missing — run npm run db:migrate.' }
    }
    return { ok: false, error: msg }
  }
  const plan = await findPlanById(id)
  if (!plan) return { ok: false, error: 'Plan create failed.' }
  const { persistSubscriptionPlanLocales } = await import('./plan-locales')
  await persistSubscriptionPlanLocales({
    planId: plan.id,
    title: plan.title,
    description: plan.description,
    titleLocales: input.titleLocales,
    descriptionLocales: input.descriptionLocales,
  })
  return { ok: true, plan }
}

export async function updatePlan(
  input: SavePlanInput & { id: string },
): Promise<{ ok: true; plan: SubscriptionPlanRecord } | { ok: false; error: string }> {
  const id = input.id.trim()
  if (!id) return { ok: false, error: 'Missing plan id.' }
  const existing = await findPlanById(id)
  if (!existing) return { ok: false, error: 'Plan not found.' }
  const values = planValuesFromInput(input, existing)
  if (!values.title) return { ok: false, error: 'Title is required.' }
  try {
    await db
      .update(sfSubPlans)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(sfSubPlans.id, id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, error: msg }
  }
  const plan = await findPlanById(id)
  if (!plan) return { ok: false, error: 'Plan update failed.' }
  const { persistSubscriptionPlanLocales } = await import('./plan-locales')
  await persistSubscriptionPlanLocales({
    planId: plan.id,
    title: plan.title,
    description: plan.description,
    titleLocales: input.titleLocales,
    descriptionLocales: input.descriptionLocales,
  })
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

export async function findPeriodById(id: string): Promise<SubscriptionPeriodRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const rows = await db.select().from(sfSubPeriods).where(eq(sfSubPeriods.id, trimmed)).limit(1)
    return rows[0] ? mapPeriod(rows[0]) : null
  } catch {
    return null
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
    const periods = rows.map(mapPeriod)
    const planIds = [...new Set(periods.map((p) => p.planId))]
    const plans = await listPlansByIds(planIds)
    const graceByPlan = new Map(plans.map((p) => [p.id, p.graceHours] as const))
    return periods.filter((p) => {
      const grace = graceByPlan.get(p.planId) ?? 0
      const end = periodEffectiveEnd(p, grace)
      return end.getTime() > now.getTime() && p.startsAt.getTime() <= now.getTime()
    })
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

  // Seat members inherit parent period entitlements.
  try {
    const seatRows = await db
      .select()
      .from(sfSubSeats)
      .where(eq(sfSubSeats.userId, userId.trim()))
    for (const seat of seatRows) {
      const parent = await findPeriodById(seat.periodId)
      if (!parent || parent.status !== 'active') continue
      const plan = await findPlanById(parent.planId)
      const grace = plan?.graceHours ?? 0
      if (periodEffectiveEnd(parent, grace).getTime() <= now.getTime()) continue
      if (!periodIds.includes(parent.id)) periodIds.push(parent.id)
      for (const k of parent.entitlementKeys) {
        if (!entitlementKeys.includes(k)) entitlementKeys.push(k)
      }
      for (const g of parent.groupIds) {
        if (!groupIds.includes(g)) groupIds.push(g)
      }
    }
  } catch {
    /* seats table may be missing pre-migrate */
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

export async function countActivePeriodsForPlan(planId: string, now = new Date()): Promise<number> {
  const id = planId.trim()
  if (!id) return 0
  const periods = await listPeriods({ planId: id, status: 'active', limit: 500 })
  return periods.filter((p) => p.endsAt.getTime() > now.getTime()).length
}

export async function userHasUsedTrial(userId: string, planId: string): Promise<boolean> {
  const uid = userId.trim()
  const pid = planId.trim()
  if (!uid || !pid) return false
  try {
    const rows = await db
      .select({ id: sfSubPeriods.id })
      .from(sfSubPeriods)
      .where(
        and(
          eq(sfSubPeriods.userId, uid),
          eq(sfSubPeriods.planId, pid),
          eq(sfSubPeriods.isTrial, true),
        ),
      )
      .limit(1)
    return Boolean(rows[0])
  } catch {
    return false
  }
}

export type ResolveCheckoutPriceInput = {
  plan: SubscriptionPlanRecord
  userId: string
  mode: 'subscribe' | 'renew' | 'upgrade'
  now?: Date
}

/** Server-side price major units before Payments conversion. */
export async function resolveCheckoutPriceMajor(
  input: ResolveCheckoutPriceInput,
): Promise<{ priceMajor: number; isTrial: boolean; reason: string }> {
  const now = input.now ?? new Date()
  const { plan, userId, mode } = input

  if (mode === 'subscribe' && plan.trialDurationDays > 0) {
    const used = plan.trialOnce ? await userHasUsedTrial(userId, plan.id) : false
    if (!used) {
      return { priceMajor: plan.trialPrice, isTrial: true, reason: 'trial' }
    }
  }

  if (mode === 'renew' && plan.earlyRenewPrice != null) {
    const active = await listActivePeriodsForUser(userId, now)
    const current = active.find((p) => p.planId === plan.id)
    if (current) {
      const daysLeft = (current.endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      if (plan.earlyRenewDays <= 0 || daysLeft <= plan.earlyRenewDays) {
        return { priceMajor: plan.earlyRenewPrice, isTrial: false, reason: 'early_renew' }
      }
    }
  }

  if (mode === 'upgrade') {
    // Full target price for MVP; proration credit applied separately when computing delta.
    return { priceMajor: plan.price, isTrial: false, reason: 'upgrade' }
  }

  return { priceMajor: plan.price, isTrial: false, reason: 'list' }
}

export type ActivatePeriodInput = {
  planId: string
  userId: string
  orderId?: string | null
  source?: string
  subject?: string
  audience?: string
  billingPeriod?: PlanBillingPeriod
  entitlementKeys?: string[]
  groupIds?: string[]
  sourceModule?: string
  sourceType?: string
  sourceId?: string
  now?: Date
  isTrial?: boolean
  autoRenew?: boolean
  paymentsRecurringId?: string | null
  /** End sibling active periods with the same subject (upgrade). */
  exclusiveSubject?: boolean
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
  const isTrial = input.isTrial === true
  const autoRenew = input.autoRenew === true
  const paymentsRecurringId = (input.paymentsRecurringId || '').trim() || null

  try {
    const orderId = (input.orderId || '').trim() || null
    if (orderId) {
      const already = await db
        .select()
        .from(sfSubPeriods)
        .where(eq(sfSubPeriods.orderId, orderId))
        .limit(1)
      if (already[0]) {
        const existingPeriod = mapPeriod(already[0])
        const { syncGroupsOnActivate } = await import('./group-sync')
        await syncGroupsOnActivate(existingPeriod)
        return { ok: true, period: existingPeriod }
      }
    }

    if (input.exclusiveSubject) {
      const siblings = await db
        .select()
        .from(sfSubPeriods)
        .where(
          and(
            eq(sfSubPeriods.userId, userId),
            eq(sfSubPeriods.subject, subject),
            eq(sfSubPeriods.status, 'active'),
          ),
        )
      const { syncGroupsOnPeriodEnd } = await import('./group-sync')
      for (const row of siblings) {
        if (row.planId === planId) continue
        const endedSibling = mapPeriod(row)
        await db
          .update(sfSubPeriods)
          .set({ status: 'expired', updatedAt: now, endsAt: now, cancelAtPeriodEnd: false })
          .where(eq(sfSubPeriods.id, row.id))
        await syncGroupsOnPeriodEnd(endedSibling, now)
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
    if (current && current.endsAt.getTime() > now.getTime() && !isTrial) {
      if (plan?.lifetime || billingPeriod === 'lifetime' || plan?.fixedExpiresAt) {
        return {
          ok: false,
          error: 'Lifetime and fixed-end plans cannot be renewed.',
        }
      }
      const base = current.endsAt.getTime() > now.getTime() ? current.endsAt : now
      const endsAt = addBillingPeriod(base, billingPeriod, {
        lifetime: plan?.lifetime,
        fixedExpiresAt: plan?.fixedExpiresAt,
      })
      if (endsAt.getTime() <= current.endsAt.getTime()) {
        return {
          ok: false,
          error: 'Renewal would not extend this subscription.',
        }
      }
      await db
        .update(sfSubPeriods)
        .set({
          endsAt,
          // Latest paid order wins (webhook idempotency). Refunds shrink one period.
          orderId: orderId ?? current.orderId,
          entitlementKeys,
          groupIds: asStringList(groupIds),
          subject,
          audience,
          billingPeriod,
          sourceModule,
          sourceType,
          sourceId,
          isTrial: false,
          autoRenew: autoRenew || current.autoRenew,
          paymentsRecurringId: paymentsRecurringId ?? current.paymentsRecurringId,
          cancelAtPeriodEnd: false,
          reminderExpiringSentAt: null,
          reminderTrialSentAt: null,
          updatedAt: new Date(),
        })
        .where(eq(sfSubPeriods.id, current.id))
      const updated = await db
        .select()
        .from(sfSubPeriods)
        .where(eq(sfSubPeriods.id, current.id))
        .limit(1)
      const extended = mapPeriod(updated[0]!)
      const { syncGroupsOnActivate } = await import('./group-sync')
      await syncGroupsOnActivate(extended)
      return { ok: true, period: extended }
    }

    const id = newId('speriod')
    const startsAt = now
    const endsAt = addBillingPeriod(startsAt, billingPeriod, {
      lifetime: plan?.lifetime && !isTrial,
      fixedExpiresAt: isTrial ? null : plan?.fixedExpiresAt,
      trialDays: isTrial ? plan?.trialDurationDays : 0,
    })
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
      source: input.source || (isTrial ? 'trial' : 'purchase'),
      cancelAtPeriodEnd: false,
      autoRenew,
      paymentsRecurringId,
      isTrial,
      parentPeriodId: null,
      seatRole: plan && plan.seatLimit > 0 ? 'admin' : '',
    })

    if (plan && plan.seatLimit > 0) {
      await db.insert(sfSubSeats).values({
        id: newId('sseat'),
        periodId: id,
        userId,
        role: 'admin',
      })
    }

    const rows = await db.select().from(sfSubPeriods).where(eq(sfSubPeriods.id, id)).limit(1)
    const created = mapPeriod(rows[0]!)
    const { syncGroupsOnActivate } = await import('./group-sync')
    await syncGroupsOnActivate(created)
    return { ok: true, period: created }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_sub_periods|does not exist|relation/i.test(msg)) {
      return { ok: false, error: 'sf_sub_periods missing — run npm run db:migrate.' }
    }
    return { ok: false, error: msg }
  }
}

export async function activateFreePlan(input: {
  planId: string
  userId: string
}): Promise<{ ok: true; period: SubscriptionPeriodRecord } | { ok: false; error: string }> {
  const plan = await findPlanById(input.planId)
  if (!plan || !plan.active) return { ok: false, error: 'Plan not found or inactive.' }
  if (plan.price > 0 && plan.trialDurationDays <= 0) {
    return { ok: false, error: 'Plan requires payment.' }
  }
  if (plan.maxActive > 0) {
    const n = await countActivePeriodsForPlan(plan.id)
    if (n >= plan.maxActive) return { ok: false, error: 'Plan is at capacity.' }
  }
  const useTrial = plan.price > 0 && plan.trialDurationDays > 0
  if (useTrial && plan.trialOnce && (await userHasUsedTrial(input.userId, plan.id))) {
    return { ok: false, error: 'Trial already used.' }
  }
  if (!useTrial && plan.price > 0) {
    return { ok: false, error: 'Plan requires payment.' }
  }
  // Free list price, or free trial (trialPrice 0).
  if (useTrial && plan.trialPrice > 0) {
    return { ok: false, error: 'Trial requires payment.' }
  }
  return activateOrExtendPeriod({
    planId: plan.id,
    userId: input.userId,
    source: useTrial ? 'trial' : 'free',
    isTrial: useTrial,
  })
}

export async function endPeriodsForOrder(
  orderId: string,
  status: 'expired' | 'refunded',
): Promise<SubscriptionPeriodRecord[]> {
  const id = orderId.trim()
  if (!id) return []
  const now = new Date()
  try {
    const rows = await db
      .select()
      .from(sfSubPeriods)
      .where(and(eq(sfSubPeriods.orderId, id), eq(sfSubPeriods.status, 'active')))
    const ended: SubscriptionPeriodRecord[] = []
    const { syncGroupsOnPeriodEnd } = await import('./group-sync')
    for (const row of rows) {
      const period = mapPeriod(row)
      if (status === 'refunded') {
        const bp = period.billingPeriod
        const canShrink =
          bp !== 'lifetime' &&
          !period.isTrial &&
          period.endsAt.getTime() > now.getTime()
        if (canShrink) {
          const shrunkEnds = subtractBillingPeriod(period.endsAt, bp)
          if (
            shrunkEnds.getTime() > now.getTime() &&
            shrunkEnds.getTime() > period.startsAt.getTime()
          ) {
            await db
              .update(sfSubPeriods)
              .set({
                endsAt: shrunkEnds,
                orderId: null,
                updatedAt: now,
                reminderExpiringSentAt: null,
                reminderTrialSentAt: null,
              })
              .where(eq(sfSubPeriods.id, period.id))
            continue
          }
        }
      }
      await db
        .update(sfSubPeriods)
        .set({ status, updatedAt: now, endsAt: now })
        .where(eq(sfSubPeriods.id, period.id))
      const closed = { ...period, status, endsAt: now }
      ended.push(closed)
      await syncGroupsOnPeriodEnd(closed, now)
    }
    return ended
  } catch {
    return []
  }
}

/** Mark active periods past endsAt (+ plan grace) as expired. Returns ended period rows. */
export async function expireLapsedPeriods(
  now = new Date(),
): Promise<SubscriptionPeriodRecord[]> {
  try {
    const active = await db
      .select()
      .from(sfSubPeriods)
      .where(and(eq(sfSubPeriods.status, 'active'), lte(sfSubPeriods.endsAt, now)))
    const planIds = [...new Set(active.map((row) => row.planId))]
    const plans =
      planIds.length > 0
        ? (await db.select().from(sfSubPlans).where(inArray(sfSubPlans.id, planIds))).map(mapPlan)
        : []
    const graceByPlan = new Map(plans.map((p) => [p.id, p.graceHours] as const))
    const ended: SubscriptionPeriodRecord[] = []
    const { syncGroupsOnPeriodEnd } = await import('./group-sync')
    for (const row of active) {
      const period = mapPeriod(row)
      const grace = graceByPlan.get(period.planId) ?? 0
      if (periodEffectiveEnd(period, grace).getTime() > now.getTime()) continue
      if (period.cancelAtPeriodEnd || !period.autoRenew) {
        await db
          .update(sfSubPeriods)
          .set({ status: 'expired', updatedAt: now })
          .where(eq(sfSubPeriods.id, period.id))
        const closed = { ...period, status: 'expired' as const }
        ended.push(closed)
        await syncGroupsOnPeriodEnd(closed, now)
      } else {
        // autoRenew without cancel: still lapse if Payments did not extend past grace.
        await db
          .update(sfSubPeriods)
          .set({ status: 'expired', updatedAt: now, autoRenew: false })
          .where(eq(sfSubPeriods.id, period.id))
        const closed = { ...period, status: 'expired' as const, autoRenew: false }
        ended.push(closed)
        await syncGroupsOnPeriodEnd(closed, now)
      }
    }
    return ended
  } catch {
    return []
  }
}

export async function listPeriodsExpiringSoon(
  withinDays: number,
  now = new Date(),
): Promise<SubscriptionPeriodRecord[]> {
  const until = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000)
  try {
    const rows = await db
      .select()
      .from(sfSubPeriods)
      .where(
        and(
          eq(sfSubPeriods.status, 'active'),
          gte(sfSubPeriods.endsAt, now),
          lte(sfSubPeriods.endsAt, until),
          isNull(sfSubPeriods.reminderExpiringSentAt),
        ),
      )
      .limit(200)
    return rows.map(mapPeriod)
  } catch {
    return []
  }
}

export async function listTrialsEndingSoon(
  withinDays: number,
  now = new Date(),
): Promise<SubscriptionPeriodRecord[]> {
  const until = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000)
  try {
    const rows = await db
      .select()
      .from(sfSubPeriods)
      .where(
        and(
          eq(sfSubPeriods.status, 'active'),
          eq(sfSubPeriods.isTrial, true),
          gte(sfSubPeriods.endsAt, now),
          lte(sfSubPeriods.endsAt, until),
          isNull(sfSubPeriods.reminderTrialSentAt),
        ),
      )
      .limit(200)
    return rows.map(mapPeriod)
  } catch {
    return []
  }
}

export async function markReminderSent(
  periodId: string,
  kind: 'expiring' | 'trial',
  at = new Date(),
): Promise<void> {
  const id = periodId.trim()
  if (!id) return
  try {
    if (kind === 'trial') {
      await db
        .update(sfSubPeriods)
        .set({ reminderTrialSentAt: at, updatedAt: at })
        .where(eq(sfSubPeriods.id, id))
    } else {
      await db
        .update(sfSubPeriods)
        .set({ reminderExpiringSentAt: at, updatedAt: at })
        .where(eq(sfSubPeriods.id, id))
    }
  } catch {
    /* ignore */
  }
}

export async function setCancelAtPeriodEnd(
  periodId: string,
  userId: string,
  cancel: boolean,
): Promise<{ ok: true; period: SubscriptionPeriodRecord } | { ok: false; error: string }> {
  const id = periodId.trim()
  const uid = userId.trim()
  if (!id || !uid) return { ok: false, error: 'Missing period or user.' }
  const period = await findPeriodById(id)
  if (!period) return { ok: false, error: 'Subscription not found.' }
  if (period.userId !== uid) return { ok: false, error: 'Not your subscription.' }
  if (period.status !== 'active') return { ok: false, error: 'Subscription is not active.' }
  try {
    await db
      .update(sfSubPeriods)
      .set({
        cancelAtPeriodEnd: cancel,
        autoRenew: cancel ? false : period.autoRenew,
        updatedAt: new Date(),
      })
      .where(eq(sfSubPeriods.id, id))
    if (cancel && period.paymentsRecurringId) {
      try {
        const payments = await import('@/modules/payments/api')
        await payments.cancelRecurring(period.paymentsRecurringId)
      } catch {
        /* Payments recurring may be unavailable */
      }
    }
    const updated = await findPeriodById(id)
    if (!updated) return { ok: false, error: 'Update failed.' }
    return { ok: true, period: updated }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, error: msg }
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

/** Admin edit of one period window. Does not rewrite the entitlement snapshot. Refunds stay with Payments. */
export async function updatePeriodWindow(input: {
  id: string
  status: 'active' | 'expired'
  endsAt: Date
}): Promise<{ ok: true; period: SubscriptionPeriodRecord } | { ok: false; error: string }> {
  const id = input.id.trim()
  if (!id) return { ok: false, error: 'Missing subscription id.' }
  if (input.status !== 'active' && input.status !== 'expired') {
    return { ok: false, error: 'Status must be active or expired.' }
  }
  if (!(input.endsAt instanceof Date) || !Number.isFinite(input.endsAt.getTime())) {
    return { ok: false, error: 'End date is invalid.' }
  }
  try {
    const rows = await db.select().from(sfSubPeriods).where(eq(sfSubPeriods.id, id)).limit(1)
    const existing = rows[0]
    if (!existing) return { ok: false, error: 'Subscription not found.' }
    if (existing.status === 'refunded') {
      return { ok: false, error: 'Refunded periods stay closed. Payments owns refunds.' }
    }
    if (input.status === 'active' && input.endsAt.getTime() <= Date.now()) {
      return { ok: false, error: 'An active subscription needs an end date in the future.' }
    }
    const wasActive = existing.status === 'active'
    await db
      .update(sfSubPeriods)
      .set({
        status: input.status,
        endsAt: input.endsAt,
        updatedAt: new Date(),
      })
      .where(eq(sfSubPeriods.id, id))
    const updated = await db.select().from(sfSubPeriods).where(eq(sfSubPeriods.id, id)).limit(1)
    if (!updated[0]) return { ok: false, error: 'Subscription update failed.' }
    const period = mapPeriod(updated[0])
    const { syncGroupsOnActivate, syncGroupsOnPeriodEnd } = await import('./group-sync')
    if (input.status === 'active') {
      await syncGroupsOnActivate(period)
    } else if (wasActive && input.status === 'expired') {
      await syncGroupsOnPeriodEnd(period)
    }
    return { ok: true, period }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, error: msg }
  }
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

export async function listSeats(periodId: string): Promise<SubscriptionSeatRecord[]> {
  const id = periodId.trim()
  if (!id) return []
  try {
    const rows = await db.select().from(sfSubSeats).where(eq(sfSubSeats.periodId, id))
    return rows.map(mapSeat)
  } catch {
    return []
  }
}

export async function addSeat(input: {
  periodId: string
  adminUserId: string
  memberUserId: string
}): Promise<{ ok: true; seat: SubscriptionSeatRecord } | { ok: false; error: string }> {
  const period = await findPeriodById(input.periodId)
  if (!period || period.status !== 'active') return { ok: false, error: 'Period not active.' }
  if (period.userId !== input.adminUserId.trim()) {
    return { ok: false, error: 'Only the group admin can add seats.' }
  }
  const plan = await findPlanById(period.planId)
  if (!plan || plan.seatLimit <= 0) return { ok: false, error: 'Plan does not support seats.' }
  const seats = await listSeats(period.id)
  if (seats.length >= plan.seatLimit) return { ok: false, error: 'Seat limit reached.' }
  const memberUserId = input.memberUserId.trim()
  if (!memberUserId) return { ok: false, error: 'Member user id required.' }
  if (seats.some((s) => s.userId === memberUserId)) {
    return { ok: false, error: 'User already has a seat.' }
  }
  try {
    const id = newId('sseat')
    await db.insert(sfSubSeats).values({
      id,
      periodId: period.id,
      userId: memberUserId,
      role: 'member',
    })
    const rows = await db.select().from(sfSubSeats).where(eq(sfSubSeats.id, id)).limit(1)
    return { ok: true, seat: mapSeat(rows[0]!) }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, error: msg }
  }
}

export async function removeSeat(input: {
  periodId: string
  adminUserId: string
  memberUserId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const period = await findPeriodById(input.periodId)
  if (!period) return { ok: false, error: 'Period not found.' }
  if (period.userId !== input.adminUserId.trim()) {
    return { ok: false, error: 'Only the group admin can remove seats.' }
  }
  const memberUserId = input.memberUserId.trim()
  if (memberUserId === period.userId) {
    return { ok: false, error: 'Cannot remove the group admin seat.' }
  }
  try {
    await db
      .delete(sfSubSeats)
      .where(
        and(eq(sfSubSeats.periodId, period.id), eq(sfSubSeats.userId, memberUserId)),
      )
    return { ok: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, error: msg }
  }
}

export async function periodsToCsv(periods: SubscriptionPeriodRecord[]): Promise<string> {
  const header = [
    'id',
    'planId',
    'userId',
    'status',
    'startsAt',
    'endsAt',
    'subject',
    'audience',
    'orderId',
    'source',
    'isTrial',
    'autoRenew',
    'cancelAtPeriodEnd',
  ]
  const lines = [header.join(',')]
  for (const p of periods) {
    lines.push(
      [
        p.id,
        p.planId,
        p.userId,
        p.status,
        p.startsAt.toISOString(),
        p.endsAt.toISOString(),
        p.subject,
        p.audience,
        p.orderId ?? '',
        p.source,
        String(p.isTrial),
        String(p.autoRenew),
        String(p.cancelAtPeriodEnd),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    )
  }
  return lines.join('\n')
}

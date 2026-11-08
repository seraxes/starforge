import 'server-only'

import { and, desc, eq, sql } from 'drizzle-orm'
import { randomBytes, randomUUID } from 'node:crypto'

import { db } from '@/core/db'
import {
  computeMoneyLine,
  createBillingProvider,
  formatMoneyMinor,
  getFiscalProvider,
  getPaymentsProviderForMethod,
  isOfflinePaymentMethod,
  sumMoneyLines,
  type PaymentMethodKind,
} from '@/core/payments'

import { runPaymentConsumerHook } from './consumer-hooks'
import { emitPaymentsEmail } from './email'
import {
  getMerchantById,
  loadBillingCredentials,
  loadGatewayCredentials,
} from './merchant-store'
import {
  sfPayCartLines,
  sfPayCarts,
  sfPayFiscalOutbox,
  sfPayIntents,
  sfPayInvoiceLines,
  sfPayInvoiceSequences,
  sfPayInvoices,
  sfPayOrderLines,
  sfPayOrders,
  sfPaySettings,
} from './schema'
import type {
  BuyerInfo,
  CartLineInput,
  MarkPaidInput,
  OrderStatus,
  PaymentsSettings,
  StartCheckoutInput,
  StartCheckoutResult,
} from './types'

const SETTINGS_ID = 'default'

const DEFAULT_SETTINGS: PaymentsSettings = {
  currency: 'HUF',
  amountEntryMode: 'gross',
  defaultVatRateBps: 2700,
  taxCountry: 'HU',
  enabledMethods: ['bank_transfer', 'pay_at_entrance', 'cash'],
  sellerName: '',
  sellerAddress: '',
  sellerVatId: '',
  bankIban: '',
  bankName: '',
  bankAccountName: '',
  entranceInstructions: '',
  cashInstructions: '',
  invoiceSeriesPrefix: 'SF',
  checkoutTtlMinutes: 60,
}

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`
}

function paymentReference(): string {
  return `SF${randomBytes(4).toString('hex').toUpperCase()}`
}

export async function getPaymentsSettings(): Promise<PaymentsSettings> {
  try {
    const rows = await db
      .select()
      .from(sfPaySettings)
      .where(eq(sfPaySettings.id, SETTINGS_ID))
      .limit(1)
    const row = rows[0]
    if (!row) return { ...DEFAULT_SETTINGS }
    const methods = Array.isArray(row.enabledMethods)
      ? (row.enabledMethods as PaymentMethodKind[])
      : DEFAULT_SETTINGS.enabledMethods
    return {
      currency: row.currency || 'HUF',
      amountEntryMode: row.amountEntryMode === 'net' ? 'net' : 'gross',
      defaultVatRateBps: row.defaultVatRateBps ?? 2700,
      taxCountry: row.taxCountry || 'HU',
      enabledMethods: methods,
      sellerName: row.sellerName || '',
      sellerAddress: row.sellerAddress || '',
      sellerVatId: row.sellerVatId || '',
      bankIban: row.bankIban || '',
      bankName: row.bankName || '',
      bankAccountName: row.bankAccountName || '',
      entranceInstructions: row.entranceInstructions || '',
      cashInstructions: row.cashInstructions || '',
      invoiceSeriesPrefix: row.invoiceSeriesPrefix || 'SF',
      checkoutTtlMinutes: row.checkoutTtlMinutes ?? 60,
    }
  } catch {
    // sf_pay_* missing until migrate — code defaults (same pattern as Events settings).
    return { ...DEFAULT_SETTINGS }
  }
}

export async function savePaymentsSettings(
  patch: Partial<PaymentsSettings>,
): Promise<PaymentsSettings> {
  const current = await getPaymentsSettings()
  const next: PaymentsSettings = {
    ...current,
    ...patch,
    enabledMethods: patch.enabledMethods ?? current.enabledMethods,
  }
  await db
    .insert(sfPaySettings)
    .values({
      id: SETTINGS_ID,
      currency: next.currency,
      amountEntryMode: next.amountEntryMode,
      defaultVatRateBps: next.defaultVatRateBps,
      taxCountry: next.taxCountry,
      enabledMethods: next.enabledMethods,
      sellerName: next.sellerName,
      sellerAddress: next.sellerAddress,
      sellerVatId: next.sellerVatId,
      bankIban: next.bankIban,
      bankName: next.bankName,
      bankAccountName: next.bankAccountName,
      entranceInstructions: next.entranceInstructions,
      cashInstructions: next.cashInstructions,
      invoiceSeriesPrefix: next.invoiceSeriesPrefix,
      checkoutTtlMinutes: next.checkoutTtlMinutes,
    })
    .onConflictDoUpdate({
      target: sfPaySettings.id,
      set: {
        currency: next.currency,
        amountEntryMode: next.amountEntryMode,
        defaultVatRateBps: next.defaultVatRateBps,
        taxCountry: next.taxCountry,
        enabledMethods: next.enabledMethods,
        sellerName: next.sellerName,
        sellerAddress: next.sellerAddress,
        sellerVatId: next.sellerVatId,
        bankIban: next.bankIban,
        bankName: next.bankName,
        bankAccountName: next.bankAccountName,
        entranceInstructions: next.entranceInstructions,
        cashInstructions: next.cashInstructions,
        invoiceSeriesPrefix: next.invoiceSeriesPrefix,
        checkoutTtlMinutes: next.checkoutTtlMinutes,
        updatedAt: new Date(),
      },
    })
  return next
}

export async function createCart(opts?: {
  userId?: string | null
  guestToken?: string | null
}): Promise<string> {
  const settings = await getPaymentsSettings()
  const id = newId('cart')
  await db.insert(sfPayCarts).values({
    id,
    userId: opts?.userId || null,
    guestToken: opts?.guestToken || null,
    currency: settings.currency,
    status: 'draft',
  })
  return id
}

export async function addCartLine(
  cartId: string,
  input: CartLineInput,
): Promise<{ ok: true; lineId: string } | { ok: false; error: string }> {
  const settings = await getPaymentsSettings()
  const carts = await db.select().from(sfPayCarts).where(eq(sfPayCarts.id, cartId)).limit(1)
  if (!carts[0] || carts[0].status !== 'draft') {
    return { ok: false, error: 'Cart not found or not editable' }
  }
  const computed = computeMoneyLine({
    currency: settings.currency,
    qty: input.qty ?? 1,
    unitAmountMinor: input.unitAmountMinor,
    vatRateBps: input.vatRateBps ?? settings.defaultVatRateBps,
    vatCategory: input.vatCategory ?? 'standard',
    amountIsGross: settings.amountEntryMode === 'gross',
  })
  const lineId = newId('cline')
  await db.insert(sfPayCartLines).values({
    id: lineId,
    cartId,
    sourceModule: input.sourceModule,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    title: input.title.slice(0, 500),
    qty: computed.qty,
    currency: computed.currency,
    unitNetMinor: computed.unitNetMinor,
    unitGrossMinor: computed.unitGrossMinor,
    vatRateBps: computed.vatRateBps,
    vatCategory: computed.vatCategory,
    vatAmountMinor: computed.vatAmountMinor,
    lineNetMinor: computed.lineNetMinor,
    lineGrossMinor: computed.lineGrossMinor,
    billingPeriod: input.billingPeriod ?? null,
    metadata: input.metadata ?? {},
  })
  return { ok: true, lineId }
}

export async function getCartWithLines(cartId: string) {
  const carts = await db.select().from(sfPayCarts).where(eq(sfPayCarts.id, cartId)).limit(1)
  const cart = carts[0]
  if (!cart) return null
  const lines = await db.select().from(sfPayCartLines).where(eq(sfPayCartLines.cartId, cartId))
  return { cart, lines }
}

function offlineInstructions(
  method: PaymentMethodKind,
  bank: {
    bankAccountName: string
    bankName: string
    bankIban: string
    entranceInstructions: string
    cashInstructions: string
  },
  reference: string,
): string {
  if (method === 'bank_transfer') {
    return [
      `Reference: ${reference}`,
      bank.bankAccountName && `Account name: ${bank.bankAccountName}`,
      bank.bankName && `Bank: ${bank.bankName}`,
      bank.bankIban && `IBAN: ${bank.bankIban}`,
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (method === 'pay_at_entrance') {
    return bank.entranceInstructions || `Pay at entrance. Reference: ${reference}`
  }
  return bank.cashInstructions || `Pay by cash. Reference: ${reference}`
}

async function allocateInvoiceNumber(prefix: string): Promise<string> {
  const year = new Date().getFullYear()
  const seqId = `${prefix}_${year}`
  await db
    .insert(sfPayInvoiceSequences)
    .values({ id: seqId, year, prefix, lastNumber: 0 })
    .onConflictDoNothing()
  const updated = await db
    .update(sfPayInvoiceSequences)
    .set({ lastNumber: sql`${sfPayInvoiceSequences.lastNumber} + 1` })
    .where(eq(sfPayInvoiceSequences.id, seqId))
    .returning()
  const n = updated[0]?.lastNumber ?? 1
  return `${prefix}-${year}-${String(n).padStart(5, '0')}`
}

async function issueInvoiceForOrder(orderId: string): Promise<string | null> {
  const orders = await db.select().from(sfPayOrders).where(eq(sfPayOrders.id, orderId)).limit(1)
  const order = orders[0]
  if (!order) return null
  const existing = await db
    .select()
    .from(sfPayInvoices)
    .where(and(eq(sfPayInvoices.orderId, orderId), eq(sfPayInvoices.kind, 'invoice')))
    .limit(1)
  if (existing[0]) return existing[0].id

  const settings = await getPaymentsSettings()
  const lines = await db
    .select()
    .from(sfPayOrderLines)
    .where(eq(sfPayOrderLines.orderId, orderId))
  const invoiceId = newId('inv')
  const invoiceNumber = await allocateInvoiceNumber(settings.invoiceSeriesPrefix)
  const issueDate = new Date().toISOString().slice(0, 10)
  await db.insert(sfPayInvoices).values({
    id: invoiceId,
    orderId,
    invoiceNumber,
    kind: 'invoice',
    issueDate,
    currency: order.currency,
    sellerVatId: order.sellerVatId || settings.sellerVatId,
    buyerVatId: order.buyerVatId,
    buyerName: order.buyerName || order.buyerEmail,
    totalNetMinor: order.totalNetMinor,
    totalVatMinor: order.totalVatMinor,
    totalGrossMinor: order.totalGrossMinor,
    navSyncState: 'pending',
  })
  for (const line of lines) {
    await db.insert(sfPayInvoiceLines).values({
      id: newId('iline'),
      invoiceId,
      title: line.title,
      qty: line.qty,
      unitNetMinor: line.unitNetMinor,
      vatRateBps: line.vatRateBps,
      vatCategory: line.vatCategory,
      lineNetMinor: line.lineNetMinor,
      lineGrossMinor: line.lineGrossMinor,
    })
  }
  await db.insert(sfPayFiscalOutbox).values({
    id: newId('fout'),
    invoiceId,
    action: 'submit_invoice',
    status: 'pending',
    nextAttemptAt: new Date(),
  })

  await emitPaymentsEmail('product:payments/invoice_issued', {
    orderId,
    invoiceId,
    invoiceNumber,
    buyerEmail: order.buyerEmail,
    currency: order.currency,
    totalGrossMinor: order.totalGrossMinor,
    totalGrossFormatted: formatMoneyMinor(order.totalGrossMinor, order.currency),
    sellerVatId: order.sellerVatId || settings.sellerVatId,
    buyerVatId: order.buyerVatId,
  })

  // Merchant Billingo / Számlázz first; then optional NAV fiscal outbox.
  if (order.merchantId) {
    await submitMerchantBillingInvoice(order.merchantId, invoiceId)
  }
  await processFiscalOutboxItem(invoiceId)

  return invoiceId
}

async function submitMerchantBillingInvoice(
  merchantId: string,
  invoiceId: string,
): Promise<void> {
  const merchant = await getMerchantById(merchantId)
  if (!merchant || merchant.billingProvider === 'noop') return

  const invoices = await db
    .select()
    .from(sfPayInvoices)
    .where(eq(sfPayInvoices.id, invoiceId))
    .limit(1)
  const invoice = invoices[0]
  if (!invoice) return
  const lines = await db
    .select()
    .from(sfPayInvoiceLines)
    .where(eq(sfPayInvoiceLines.invoiceId, invoiceId))

  const creds = await loadBillingCredentials(merchantId, merchant.billingProvider)
  const billing = createBillingProvider(
    merchant.billingProvider,
    creds || undefined,
  )
  const result = await billing.submitInvoice({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    currency: invoice.currency,
    sellerVatId: invoice.sellerVatId || merchant.sellerVatId,
    buyerVatId: invoice.buyerVatId || undefined,
    buyerName: invoice.buyerName,
    lines: lines.map((l) => ({
      title: l.title,
      qty: l.qty,
      unitNetMinor: l.unitNetMinor,
      vatRateBps: l.vatRateBps,
      lineNetMinor: l.lineNetMinor,
      lineGrossMinor: l.lineGrossMinor,
      vatCategory: l.vatCategory as 'standard',
    })),
    totalNetMinor: invoice.totalNetMinor,
    totalVatMinor: invoice.totalVatMinor,
    totalGrossMinor: invoice.totalGrossMinor,
  })

  if (result.ok || result.skipped) {
    await db
      .update(sfPayInvoices)
      .set({
        billingProvider: merchant.billingProvider,
        billingExternalId: result.externalId || null,
      })
      .where(eq(sfPayInvoices.id, invoiceId))
  }
}

export async function processFiscalOutboxItem(invoiceId: string): Promise<void> {
  const outboxRows = await db
    .select()
    .from(sfPayFiscalOutbox)
    .where(
      and(
        eq(sfPayFiscalOutbox.invoiceId, invoiceId),
        eq(sfPayFiscalOutbox.status, 'pending'),
      ),
    )
    .limit(1)
  const job = outboxRows[0]
  if (!job) return

  const invoices = await db
    .select()
    .from(sfPayInvoices)
    .where(eq(sfPayInvoices.id, invoiceId))
    .limit(1)
  const invoice = invoices[0]
  if (!invoice) return
  const lines = await db
    .select()
    .from(sfPayInvoiceLines)
    .where(eq(sfPayInvoiceLines.invoiceId, invoiceId))

  const fiscal = getFiscalProvider()
  const result = await fiscal.submitInvoice({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    currency: invoice.currency,
    sellerVatId: invoice.sellerVatId,
    buyerVatId: invoice.buyerVatId || undefined,
    buyerName: invoice.buyerName,
    lines: lines.map((l) => ({
      title: l.title,
      qty: l.qty,
      unitNetMinor: l.unitNetMinor,
      vatRateBps: l.vatRateBps,
      lineNetMinor: l.lineNetMinor,
      lineGrossMinor: l.lineGrossMinor,
      vatCategory: l.vatCategory as 'standard',
    })),
    totalNetMinor: invoice.totalNetMinor,
    totalVatMinor: invoice.totalVatMinor,
    totalGrossMinor: invoice.totalGrossMinor,
  })

  await db
    .update(sfPayFiscalOutbox)
    .set({
      attempts: job.attempts + 1,
      status: result.ok || result.skipped ? 'done' : 'pending',
      lastError: result.error || null,
      nextAttemptAt: result.ok || result.skipped ? null : new Date(Date.now() + 60_000),
      updatedAt: new Date(),
    })
    .where(eq(sfPayFiscalOutbox.id, job.id))

  if (result.ok || result.skipped) {
    await db
      .update(sfPayInvoices)
      .set({
        navSyncState: result.skipped ? 'skipped' : 'submitted',
        fiscalRef: result.fiscalRef || null,
      })
      .where(eq(sfPayInvoices.id, invoiceId))
  }
}

async function transitionToPaid(orderId: string, opts?: {
  staffUserId?: string
  reason?: string
  /** When true, only offline awaiting_offline orders may transition (staff mark-paid). */
  offlineOnly?: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const orders = await db.select().from(sfPayOrders).where(eq(sfPayOrders.id, orderId)).limit(1)
  const order = orders[0]
  if (!order) return { ok: false, error: 'Order not found' }
  if (order.status === 'paid' || order.status === 'fulfilled' || order.status === 'refunded') {
    return { ok: true } // idempotent
  }
  if (opts?.offlineOnly) {
    if (order.status !== 'awaiting_offline' || !isOfflinePaymentMethod(order.method as PaymentMethodKind)) {
      return { ok: false, error: 'Mark paid is only allowed for offline awaiting orders' }
    }
  } else if (
    order.status !== 'awaiting_offline' &&
    order.status !== 'redirected_provider' &&
    order.status !== 'checkout_pending'
  ) {
    return { ok: false, error: `Cannot mark paid from status ${order.status}` }
  }

  // Atomic claim — only one concurrent transition wins.
  const claimed = await db
    .update(sfPayOrders)
    .set({
      status: 'paid',
      paidAt: new Date(),
      markPaidByUserId: opts?.staffUserId || null,
      markPaidReason: opts?.reason || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sfPayOrders.id, orderId),
        // Still in a payable state at write time
        // drizzle inArray for statuses
        sql`${sfPayOrders.status} in ('awaiting_offline', 'redirected_provider', 'checkout_pending')`,
      ),
    )
    .returning({ id: sfPayOrders.id })

  if (!claimed[0]) {
    // Another worker already paid / fulfilled — treat as success (idempotent).
    const again = await db.select().from(sfPayOrders).where(eq(sfPayOrders.id, orderId)).limit(1)
    if (again[0]?.status === 'paid' || again[0]?.status === 'fulfilled' || again[0]?.status === 'refunded') {
      return { ok: true }
    }
    return { ok: false, error: 'Could not claim order for paid transition' }
  }

  const invoiceId = await issueInvoiceForOrder(orderId)
  const lines = await db
    .select()
    .from(sfPayOrderLines)
    .where(eq(sfPayOrderLines.orderId, orderId))

  await emitPaymentsEmail('product:payments/paid', {
    orderId,
    buyerEmail: order.buyerEmail,
    method: order.method,
    currency: order.currency,
    totalGrossMinor: order.totalGrossMinor,
    totalGrossFormatted: formatMoneyMinor(order.totalGrossMinor, order.currency),
    paidAt: new Date().toISOString(),
    invoiceId,
    paymentReference: order.paymentReference,
    lineSummary: lines.map((l) => `${l.qty}× ${l.title}`).join(', '),
  })

  await runPaymentConsumerHook(order.consumerHook, {
    orderId,
    status: 'paid',
    lines: lines.map((l) => ({
      sourceModule: l.sourceModule,
      sourceType: l.sourceType,
      sourceId: l.sourceId,
      qty: l.qty,
      metadata: (l.metadata || {}) as Record<string, unknown>,
    })),
    metadata: (order.metadata || {}) as Record<string, unknown>,
  })

  await db
    .update(sfPayOrders)
    .set({ status: 'fulfilled', fulfilledAt: new Date(), updatedAt: new Date() })
    .where(eq(sfPayOrders.id, orderId))

  return { ok: true }
}

export async function startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
  const settings = await getPaymentsSettings()
  const merchantId = (input.merchantId || '').trim() || null
  const merchant = merchantId ? await getMerchantById(merchantId) : null
  if (merchantId && (!merchant || merchant.status === 'suspended')) {
    return { ok: false, error: 'Merchant is not available for checkout' }
  }
  // Site MoR still gates methods via settings; merchant checkout uses merchant keys.
  if (!merchantId && !settings.enabledMethods.includes(input.method)) {
    return { ok: false, error: `Payment method ${input.method} is not enabled` }
  }

  const existing = await db
    .select()
    .from(sfPayOrders)
    .where(eq(sfPayOrders.idempotencyKey, input.idempotencyKey))
    .limit(1)
  if (existing[0]) {
    return {
      ok: true,
      orderId: existing[0].id,
      status: existing[0].status as OrderStatus,
      redirectUrl: existing[0].redirectUrl || undefined,
      paymentReference: existing[0].paymentReference || undefined,
    }
  }

  const bundle = await getCartWithLines(input.cartId)
  if (!bundle || bundle.cart.status !== 'draft') {
    return { ok: false, error: 'Cart not found or already checked out' }
  }
  if (bundle.lines.length === 0) {
    return { ok: false, error: 'Cart is empty' }
  }

  const moneyLines = bundle.lines.map((l) => ({
    currency: l.currency,
    qty: l.qty,
    vatRateBps: l.vatRateBps,
    vatCategory: l.vatCategory as 'standard',
    unitNetMinor: l.unitNetMinor,
    unitGrossMinor: l.unitGrossMinor,
    vatAmountMinor: l.vatAmountMinor,
    lineNetMinor: l.lineNetMinor,
    lineGrossMinor: l.lineGrossMinor,
  }))
  const totals = sumMoneyLines(moneyLines)
  const orderId = newId('ord')
  const reference = paymentReference()
  const expiresAt = new Date(Date.now() + settings.checkoutTtlMinutes * 60_000)
  const offline = isOfflinePaymentMethod(input.method)
  const sellerVatId = merchant?.sellerVatId || settings.sellerVatId
  const bankBlock = merchant
    ? {
        bankAccountName: merchant.bankAccountName,
        bankName: merchant.bankName,
        bankIban: merchant.bankIban,
        entranceInstructions: merchant.entranceInstructions,
        cashInstructions: merchant.cashInstructions,
      }
    : settings

  let status: OrderStatus = offline ? 'awaiting_offline' : 'checkout_pending'
  let provider = offline ? 'manual' : input.method
  let providerRef: string | null = null
  let redirectUrl: string | null = null

  if (!offline) {
    const gatewayCreds = merchantId
      ? await loadGatewayCredentials(merchantId, input.method)
      : undefined
    if (merchantId && !gatewayCreds?.secret) {
      return {
        ok: false,
        error: `Merchant has no ${input.method} credentials configured`,
      }
    }
    const payments = getPaymentsProviderForMethod(input.method, gatewayCreds || undefined)
    const intent = await payments.createIntent({
      orderId,
      idempotencyKey: input.idempotencyKey,
      currency: totals.currency,
      amountMinor: totals.totalGrossMinor,
      description: bundle.lines.map((l) => l.title).join(', ').slice(0, 200) || 'Order',
      buyerEmail: input.buyer.email,
      returnUrl: input.returnUrl,
      cancelUrl: input.cancelUrl,
      metadata: {
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/payments/${input.method}/webhook`,
      },
    })
    if (!intent.ok) {
      return { ok: false, error: intent.error || 'Provider createIntent failed' }
    }
    provider = intent.provider
    providerRef = intent.providerRef || null
    redirectUrl = intent.redirectUrl || null
    status = redirectUrl ? 'redirected_provider' : 'checkout_pending'

    await db.insert(sfPayIntents).values({
      id: newId('pint'),
      orderId,
      provider: intent.provider,
      providerRef,
      status: 'requires_action',
      amountMinor: totals.totalGrossMinor,
      currency: totals.currency,
      raw: {},
    })
  }

  await db.insert(sfPayOrders).values({
    id: orderId,
    cartId: input.cartId,
    userId: input.buyer.userId || null,
    merchantId,
    buyerEmail: input.buyer.email.trim(),
    buyerName: (input.buyer.name || '').trim(),
    buyerVatId: (input.buyer.vatId || '').trim(),
    buyerIsCompany: Boolean(input.buyer.isCompany),
    currency: totals.currency,
    taxCountry: settings.taxCountry,
    sellerVatId,
    method: input.method,
    status,
    idempotencyKey: input.idempotencyKey,
    paymentReference: reference,
    platformFeeMinor: 0,
    totalNetMinor: totals.totalNetMinor,
    totalVatMinor: totals.totalVatMinor,
    totalGrossMinor: totals.totalGrossMinor,
    provider,
    providerRef,
    redirectUrl,
    expiresAt,
    consumerHook: input.consumerHook || null,
    metadata: input.metadata ?? {},
  })

  for (const line of bundle.lines) {
    await db.insert(sfPayOrderLines).values({
      id: newId('oline'),
      orderId,
      sourceModule: line.sourceModule,
      sourceType: line.sourceType,
      sourceId: line.sourceId,
      title: line.title,
      qty: line.qty,
      currency: line.currency,
      unitNetMinor: line.unitNetMinor,
      unitGrossMinor: line.unitGrossMinor,
      vatRateBps: line.vatRateBps,
      vatCategory: line.vatCategory,
      vatAmountMinor: line.vatAmountMinor,
      lineNetMinor: line.lineNetMinor,
      lineGrossMinor: line.lineGrossMinor,
      billingPeriod: line.billingPeriod,
      metadata: line.metadata || {},
    })
  }

  await db
    .update(sfPayCarts)
    .set({ status: 'checked_out', updatedAt: new Date() })
    .where(eq(sfPayCarts.id, input.cartId))

  await emitPaymentsEmail('product:payments/checkout_started', {
    orderId,
    buyerEmail: input.buyer.email,
    method: input.method,
    currency: totals.currency,
    totalGrossMinor: totals.totalGrossMinor,
    totalGrossFormatted: formatMoneyMinor(totals.totalGrossMinor, totals.currency),
    paymentReference: reference,
  })

  if (offline) {
    const instructions = offlineInstructions(input.method, bankBlock, reference)
    await emitPaymentsEmail('product:payments/awaiting_offline', {
      orderId,
      buyerEmail: input.buyer.email,
      method: input.method,
      paymentReference: reference,
      instructions,
      currency: totals.currency,
      totalGrossMinor: totals.totalGrossMinor,
      totalGrossFormatted: formatMoneyMinor(totals.totalGrossMinor, totals.currency),
    })
  }

  return {
    ok: true,
    orderId,
    status,
    redirectUrl: redirectUrl || undefined,
    paymentReference: reference,
  }
}

export async function markOrderPaid(input: MarkPaidInput) {
  if (!input.reason.trim()) {
    return { ok: false as const, error: 'Reason required for audit' }
  }
  return transitionToPaid(input.orderId, {
    staffUserId: input.staffUserId,
    reason: input.reason.trim(),
    offlineOnly: true,
  })
}

export async function applyProviderPaymentResult(opts: {
  providerRef: string
  status: 'succeeded' | 'failed' | 'cancelled' | 'pending' | 'requires_action'
  /** Provider-reported amount — required for succeeded (must match order gross). */
  amountMinor?: number | null
  currency?: string | null
}): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const orders = await db
    .select()
    .from(sfPayOrders)
    .where(eq(sfPayOrders.providerRef, opts.providerRef))
    .limit(1)
  const order = orders[0]
  if (!order) return { ok: false, error: 'Order not found for providerRef' }

  if (opts.status === 'succeeded') {
    if (opts.amountMinor == null || !Number.isFinite(opts.amountMinor)) {
      return { ok: false, error: 'Missing verified amount — refusing capture', orderId: order.id }
    }
    if (Math.floor(opts.amountMinor) !== order.totalGrossMinor) {
      return { ok: false, error: 'Amount mismatch — refusing capture', orderId: order.id }
    }
    if (
      opts.currency &&
      opts.currency.trim().toUpperCase() !== order.currency.toUpperCase()
    ) {
      return { ok: false, error: 'Currency mismatch — refusing capture', orderId: order.id }
    }
    const r = await transitionToPaid(order.id)
    return r.ok ? { ok: true, orderId: order.id } : { ok: false, error: r.error, orderId: order.id }
  }

  if (opts.status === 'failed' || opts.status === 'cancelled') {
    if (order.status === 'paid' || order.status === 'fulfilled') {
      return { ok: true, orderId: order.id }
    }
    await db
      .update(sfPayOrders)
      .set({
        status: opts.status === 'cancelled' ? 'expired' : 'failed',
        updatedAt: new Date(),
      })
      .where(eq(sfPayOrders.id, order.id))
    await emitPaymentsEmail(
      opts.status === 'cancelled' ? 'product:payments/expired' : 'product:payments/failed',
      {
        orderId: order.id,
        buyerEmail: order.buyerEmail,
        reason: opts.status,
      },
    )
    await runPaymentConsumerHook(order.consumerHook, {
      orderId: order.id,
      status: opts.status === 'cancelled' ? 'expired' : 'failed',
      lines: [],
      metadata: (order.metadata || {}) as Record<string, unknown>,
    })
  }
  return { ok: true, orderId: order.id }
}

export async function verifyAndCaptureOrder(orderId: string) {
  const orders = await db.select().from(sfPayOrders).where(eq(sfPayOrders.id, orderId)).limit(1)
  const order = orders[0]
  if (!order?.providerRef) return { ok: false as const, error: 'No provider ref' }
  const gatewayCreds = order.merchantId
    ? await loadGatewayCredentials(order.merchantId, order.method)
    : undefined
  const provider = getPaymentsProviderForMethod(order.method, gatewayCreds || undefined)
  const verified = await provider.verifyIntent(order.providerRef)
  if (verified.amountMinor != null && verified.amountMinor !== order.totalGrossMinor) {
    return { ok: false as const, error: 'Amount mismatch — refusing capture' }
  }
  if (verified.status === 'succeeded') {
    return transitionToPaid(order.id)
  }
  return { ok: false as const, error: verified.error || `Status ${verified.status}` }
}

/** Resolve provider adapter for an existing providerRef (merchant or site keys). */
export async function resolveProviderForProviderRef(providerRef: string, method: string) {
  const orders = await db
    .select()
    .from(sfPayOrders)
    .where(eq(sfPayOrders.providerRef, providerRef))
    .limit(1)
  const order = orders[0]
  const gatewayCreds = order?.merchantId
    ? await loadGatewayCredentials(order.merchantId, method)
    : undefined
  return {
    order,
    provider: getPaymentsProviderForMethod(method, gatewayCreds || undefined),
  }
}

export async function listOrders(limit = 50) {
  try {
    return await db.select().from(sfPayOrders).orderBy(desc(sfPayOrders.createdAt)).limit(limit)
  } catch {
    return []
  }
}

export async function getOrderWithLines(orderId: string) {
  const orders = await db.select().from(sfPayOrders).where(eq(sfPayOrders.id, orderId)).limit(1)
  const order = orders[0]
  if (!order) return null
  const lines = await db.select().from(sfPayOrderLines).where(eq(sfPayOrderLines.orderId, orderId))
  const invoices = await db
    .select()
    .from(sfPayInvoices)
    .where(eq(sfPayInvoices.orderId, orderId))
  return { order, lines, invoices }
}

export async function listInvoices(limit = 50) {
  try {
    return await db.select().from(sfPayInvoices).orderBy(desc(sfPayInvoices.createdAt)).limit(limit)
  } catch {
    return []
  }
}

export type { BuyerInfo }

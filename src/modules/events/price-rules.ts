/**
 * Ticket price quote. Major units, integer.
 * Percent adjustments are of the base price only (they do not compound).
 * Checkout must call this server-side — never trust a client total.
 */

export type PriceAdjustMode = 'amount' | 'percent'

export type TierTimePriceRule = {
  /** Apply when time left until start is at most this many minutes. */
  withinMinutes: number
  mode: PriceAdjustMode
  /** Major-unit amount, or percent points (10 = +10%). May be negative. */
  value: number
}

export type TierSoldPriceRule = {
  threshold: number
  basis: 'count' | 'percent'
  mode: PriceAdjustMode
  value: number
}

export type TierPriceRules = {
  time: TierTimePriceRule | null
  sold: TierSoldPriceRule | null
}

export const EMPTY_TIER_PRICE_RULES: TierPriceRules = { time: null, sold: null }

export type PriceModifier = {
  mode: PriceAdjustMode
  value: number
}

export const ZERO_PRICE_MODIFIER: PriceModifier = { mode: 'amount', value: 0 }

/**
 * One field: `500` / `+500` / `-200` = amount; `10%` / `-5%` = percent of the price in effect.
 */
export function parsePriceModifierInput(raw: unknown): PriceModifier {
  if (raw == null) return ZERO_PRICE_MODIFIER
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { mode: 'amount', value: Math.trunc(raw) }
  }
  const s = String(raw).trim().replace(/\s+/g, '')
  if (!s) return ZERO_PRICE_MODIFIER
  const percent = s.endsWith('%')
  const numPart = percent ? s.slice(0, -1) : s
  const n = Number(numPart)
  if (!Number.isFinite(n)) return ZERO_PRICE_MODIFIER
  return { mode: percent ? 'percent' : 'amount', value: Math.trunc(n) }
}

/** Display value for the shared modifier input. */
export function formatPriceModifierInput(mod: PriceModifier | null | undefined): string {
  if (!mod || !Number.isFinite(mod.value) || mod.value === 0) return ''
  return mod.mode === 'percent' ? `${mod.value}%` : String(mod.value)
}

export type QuoteTierPriceInput = {
  /** Event base (individual price). Used when the ticket type has no price. */
  eventPrice?: number | null
  /**
   * Ticket-type price. When set, it replaces the event base
   * (Event Booking: the type price is what that slot costs).
   */
  price: number | null
  /**
   * Ticket-type modifier. Amount is added; percent is of the price in effect
   * (event base or the type price that replaced it).
   */
  priceModifier?: number | PriceModifier
  priceModifierMode?: PriceAdjustMode
  /** Event-level time and sold rules. Percent is of the price in effect. */
  rules?: TierPriceRules | null
  startsAt?: Date | null
  now?: Date
  /** Guests already holding a seat on the event. */
  sold?: number
  /** Event capacity for a percent-of-capacity sold rule. */
  capacity?: number | null
  /** Extra major units from the registration form (options / checkbox). */
  formAddonMajor?: number
}

function resolvePriceModifier(input: QuoteTierPriceInput): PriceModifier {
  if (input.priceModifier && typeof input.priceModifier === 'object') {
    return {
      mode: input.priceModifier.mode === 'percent' ? 'percent' : 'amount',
      value: asInt(input.priceModifier.value),
    }
  }
  const value =
    typeof input.priceModifier === 'number' && Number.isFinite(input.priceModifier)
      ? asInt(input.priceModifier)
      : 0
  const mode = input.priceModifierMode === 'percent' ? 'percent' : 'amount'
  return { mode, value }
}

function asInt(n: number): number {
  return Math.trunc(n)
}

function adjust(base: number, mode: PriceAdjustMode, value: number): number {
  if (mode === 'percent') {
    return asInt((base * value) / 100)
  }
  return asInt(value)
}

export function quoteTierMajor(input: QuoteTierPriceInput): number {
  const form =
    typeof input.formAddonMajor === 'number' && Number.isFinite(input.formAddonMajor)
      ? asInt(input.formAddonMajor)
      : 0
  const typePrice = input.price == null ? null : asInt(input.price)
  const eventPrice =
    input.eventPrice == null || !Number.isFinite(input.eventPrice)
      ? null
      : asInt(input.eventPrice)
  const mod = resolvePriceModifier(input)
  if (typePrice == null && eventPrice == null) {
    return form + (mod.mode === 'amount' ? mod.value : 0)
  }

  const base = typePrice ?? eventPrice ?? 0
  const fixed = adjust(base, mod.mode, mod.value)
  const rules = input.rules ?? EMPTY_TIER_PRICE_RULES
  let timeAdj = 0
  let soldAdj = 0

  const startsAt = input.startsAt ?? null
  const now = input.now ?? new Date()
  if (rules.time && startsAt && !Number.isNaN(startsAt.getTime())) {
    const remainingMin = (startsAt.getTime() - now.getTime()) / 60_000
    if (remainingMin <= rules.time.withinMinutes) {
      timeAdj = adjust(base, rules.time.mode, rules.time.value)
    }
  }

  if (rules.sold) {
    const sold = Math.max(0, asInt(input.sold ?? 0))
    const cap =
      typeof input.capacity === 'number' && Number.isFinite(input.capacity)
        ? Math.max(0, asInt(input.capacity))
        : null
    const hit =
      rules.sold.basis === 'percent'
        ? cap != null && cap > 0 && (sold / cap) * 100 >= rules.sold.threshold
        : sold >= rules.sold.threshold
    if (hit) soldAdj = adjust(base, rules.sold.mode, rules.sold.value)
  }

  return base + fixed + timeAdj + soldAdj + form
}

function parseMode(raw: unknown): PriceAdjustMode | null {
  const s = String(raw ?? '').trim()
  if (s === 'amount' || s === 'percent') return s
  return null
}

function parseNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n)) return null
  return n
}

export function parseTierPriceRules(raw: unknown): TierPriceRules {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return EMPTY_TIER_PRICE_RULES
  const row = raw as Record<string, unknown>
  return {
    time: parseTimeRule(row.time),
    sold: parseSoldRule(row.sold),
  }
}

function parseTimeRule(raw: unknown): TierTimePriceRule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const mode = parseMode(row.mode)
  const within = parseNumber(row.withinMinutes)
  const value = parseNumber(row.value)
  if (!mode || within == null || within <= 0 || value == null) return null
  return { withinMinutes: Math.floor(within), mode, value: Math.trunc(value) }
}

function parseSoldRule(raw: unknown): TierSoldPriceRule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const mode = parseMode(row.mode)
  const basis = row.basis === 'percent' ? 'percent' : row.basis === 'count' ? 'count' : null
  const threshold = parseNumber(row.threshold)
  const value = parseNumber(row.value)
  if (!mode || !basis || threshold == null || threshold < 0 || value == null) return null
  return {
    basis,
    threshold: Math.floor(threshold),
    mode,
    value: Math.trunc(value),
  }
}

/** Admin form → stored rules. Unchecked axes are cleared. */
export function priceRulesFromForm(formData: {
  get(name: string): FormDataEntryValue | null
}): TierPriceRules {
  const timeOn = formData.get('timeRuleEnabled') === '1'
  const soldOn = formData.get('soldRuleEnabled') === '1'
  const timeMode = parseMode(formData.get('timeRuleMode'))
  const soldMode = parseMode(formData.get('soldRuleMode'))
  const withinHours = parseNumber(formData.get('timeRuleWithinHours'))
  const timeValue = parseNumber(formData.get('timeRuleValue'))
  const soldThreshold = parseNumber(formData.get('soldRuleThreshold'))
  const soldValue = parseNumber(formData.get('soldRuleValue'))
  const soldBasis = formData.get('soldRuleBasis') === 'percent' ? 'percent' : 'count'

  const time: TierTimePriceRule | null =
    timeOn && timeMode && withinHours != null && withinHours > 0 && timeValue != null
      ? {
          withinMinutes: Math.round(withinHours * 60),
          mode: timeMode,
          value: Math.trunc(timeValue),
        }
      : null

  const sold: TierSoldPriceRule | null =
    soldOn && soldMode && soldThreshold != null && soldThreshold >= 0 && soldValue != null
      ? {
          basis: soldBasis,
          threshold: Math.floor(soldThreshold),
          mode: soldMode,
          value: Math.trunc(soldValue),
        }
      : null

  return { time, sold }
}

export type FormPriceField = {
  name: string
  type: string
  priceAmount?: number
  options?: Array<{ value: string; priceAmount?: number }>
}

function payloadValues(payload: Record<string, unknown>, name: string): string[] {
  const v = payload[name]
  if (v == null) return []
  if (Array.isArray(v)) return v.map((item) => String(item).trim()).filter(Boolean)
  const s = String(v).trim()
  return s ? [s] : []
}

function addonAmount(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0
  return Math.trunc(raw)
}

/** Sum option / checkbox price add-ons from a Forms definition and a submission payload. */
export function sumFormPriceAddons(
  fields: FormPriceField[],
  payload: Record<string, unknown>,
): number {
  let total = 0
  for (const field of fields) {
    const selected = payloadValues(payload, field.name)
    if (selected.length === 0) continue
    if (field.type === 'checkbox') {
      const on = selected.some((v) => v === '1' || v === 'true' || v === 'on' || v === 'yes')
      if (on) total += addonAmount(field.priceAmount)
      continue
    }
    if (!field.options?.length) continue
    const picked = new Set(selected)
    for (const option of field.options) {
      if (picked.has(option.value)) total += addonAmount(option.priceAmount)
    }
  }
  return total
}

/** Empty → null. Otherwise an integer major-unit amount (may be 0). */
export function parseOptionalMajor(raw: unknown): number | null {
  const n = parseNumber(raw)
  if (n == null) return null
  return Math.trunc(n)
}

/** ISO 4217 code, or empty when the event inherits the Payments site currency. */
export function parseEventCurrency(raw: unknown): string {
  const s = String(raw ?? '').trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(s)) return ''
  return s
}

/**
 * Safe schema-driven math expressions for Form fields (no eval / SurveyJS).
 * Supports: numbers, field refs, + - * / ( ), comparisons, and
 * sum / min / max / abs / round.
 */

export type FormExprContext = Record<string, string | number | boolean | null | undefined>

export type FormExprResult =
  | { ok: true; value: number | boolean }
  | { ok: false; error: string }

type Tok =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'comma' }

const OPS = new Set(['+', '-', '*', '/', '==', '!=', '<=', '>=', '<', '>'])

function tokenize(source: string): Tok[] | { error: string } {
  const s = source.trim()
  if (!s) return { error: 'Empty expression.' }
  const out: Tok[] = []
  let i = 0
  while (i < s.length) {
    const ch = s[i]!
    if (/\s/.test(ch)) {
      i += 1
      continue
    }
    if (ch === '(') {
      out.push({ t: 'lp' })
      i += 1
      continue
    }
    if (ch === ')') {
      out.push({ t: 'rp' })
      i += 1
      continue
    }
    if (ch === ',') {
      out.push({ t: 'comma' })
      i += 1
      continue
    }
    if (ch === '=' || ch === '!' || ch === '<' || ch === '>') {
      const two = s.slice(i, i + 2)
      if (OPS.has(two)) {
        out.push({ t: 'op', v: two })
        i += 2
        continue
      }
      if (ch === '<' || ch === '>') {
        out.push({ t: 'op', v: ch })
        i += 1
        continue
      }
      return { error: `Unexpected operator near "${ch}".` }
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      out.push({ t: 'op', v: ch })
      i += 1
      continue
    }
    if (/[0-9.]/.test(ch)) {
      let j = i + 1
      while (j < s.length && /[0-9.]/.test(s[j]!)) j += 1
      const raw = s.slice(i, j)
      const n = Number(raw)
      if (!Number.isFinite(n)) return { error: `Invalid number "${raw}".` }
      out.push({ t: 'num', v: n })
      i = j
      continue
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i + 1
      while (j < s.length && /[a-zA-Z0-9_:-]/.test(s[j]!)) j += 1
      out.push({ t: 'id', v: s.slice(i, j) })
      i = j
      continue
    }
    return { error: `Unexpected character "${ch}".` }
  }
  return out
}

function toNumber(raw: string | number | boolean | null | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN
  if (typeof raw === 'boolean') return raw ? 1 : 0
  if (raw == null) return NaN
  const t = String(raw).trim()
  if (!t || t === 'false') return t === 'false' ? 0 : NaN
  if (t === 'true' || t === 'on') return 1
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

type ParseState = { toks: Tok[]; i: number }

function peek(st: ParseState): Tok | undefined {
  return st.toks[st.i]
}

function take(st: ParseState): Tok | undefined {
  return st.toks[st.i++]
}

function parseExpr(st: ParseState, ctx: FormExprContext): FormExprResult {
  return parseCompare(st, ctx)
}

function parseCompare(st: ParseState, ctx: FormExprContext): FormExprResult {
  const left = parseAdd(st, ctx)
  if (!left.ok) return left
  const op = peek(st)
  if (op?.t === 'op' && ['==', '!=', '<', '>', '<=', '>='].includes(op.v)) {
    take(st)
    const right = parseAdd(st, ctx)
    if (!right.ok) return right
    const a = typeof left.value === 'boolean' ? (left.value ? 1 : 0) : left.value
    const b = typeof right.value === 'boolean' ? (right.value ? 1 : 0) : right.value
    let ok = false
    switch (op.v) {
      case '==':
        ok = a === b
        break
      case '!=':
        ok = a !== b
        break
      case '<':
        ok = a < b
        break
      case '>':
        ok = a > b
        break
      case '<=':
        ok = a <= b
        break
      case '>=':
        ok = a >= b
        break
    }
    return { ok: true, value: ok }
  }
  return left
}

function peekOp(st: ParseState): string | null {
  const tok = peek(st)
  return tok?.t === 'op' ? tok.v : null
}

function asFiniteNumber(value: number | boolean): number {
  return typeof value === 'boolean' ? (value ? 1 : 0) : value
}

function parseAdd(st: ParseState, ctx: FormExprContext): FormExprResult {
  let left = parseMul(st, ctx)
  if (!left.ok) return left
  for (;;) {
    const opV = peekOp(st)
    if (opV !== '+' && opV !== '-') break
    take(st)
    const right = parseMul(st, ctx)
    if (!right.ok) return right
    if (!left.ok) return left
    const aNum: number = asFiniteNumber(left.value)
    const bNum: number = asFiniteNumber(right.value)
    if (!Number.isFinite(aNum) || !Number.isFinite(bNum)) {
      return { ok: false, error: 'Arithmetic requires numeric values.' }
    }
    const next: number = opV === '+' ? aNum + bNum : aNum - bNum
    left = { ok: true, value: next }
  }
  return left
}

function parseMul(st: ParseState, ctx: FormExprContext): FormExprResult {
  let left = parseUnary(st, ctx)
  if (!left.ok) return left
  for (;;) {
    const opV = peekOp(st)
    if (opV !== '*' && opV !== '/') break
    take(st)
    const right = parseUnary(st, ctx)
    if (!right.ok) return right
    if (!left.ok) return left
    const aNum: number = asFiniteNumber(left.value)
    const bNum: number = asFiniteNumber(right.value)
    if (!Number.isFinite(aNum) || !Number.isFinite(bNum)) {
      return { ok: false, error: 'Arithmetic requires numeric values.' }
    }
    if (opV === '/' && bNum === 0) return { ok: false, error: 'Division by zero.' }
    const next: number = opV === '*' ? aNum * bNum : aNum / bNum
    left = { ok: true, value: next }
  }
  return left
}

function parseUnary(st: ParseState, ctx: FormExprContext): FormExprResult {
  const opV = peekOp(st)
  if (opV === '-') {
    take(st)
    const inner = parseUnary(st, ctx)
    if (!inner.ok) return inner
    const n = Number(inner.value)
    if (!Number.isFinite(n)) return { ok: false, error: 'Unary minus needs a number.' }
    return { ok: true, value: -n }
  }
  if (opV === '+') {
    take(st)
    return parseUnary(st, ctx)
  }
  return parsePrimary(st, ctx)
}

function parseArgs(st: ParseState, ctx: FormExprContext): FormExprResult & { values?: number[] } {
  const values: number[] = []
  if (peek(st)?.t === 'rp') return { ok: true, value: 0, values }
  for (;;) {
    const arg = parseExpr(st, ctx)
    if (!arg.ok) return arg
    const n = Number(arg.value)
    if (!Number.isFinite(n)) return { ok: false, error: 'Function args must be numeric.' }
    values.push(n)
    if (peek(st)?.t === 'comma') {
      take(st)
      continue
    }
    break
  }
  return { ok: true, value: values[0] ?? 0, values }
}

function parsePrimary(st: ParseState, ctx: FormExprContext): FormExprResult {
  const tok = take(st)
  if (!tok) return { ok: false, error: 'Unexpected end of expression.' }
  if (tok.t === 'num') return { ok: true, value: tok.v }
  if (tok.t === 'lp') {
    const inner = parseExpr(st, ctx)
    if (!inner.ok) return inner
    if (peek(st)?.t !== 'rp') return { ok: false, error: 'Missing ")".' }
    take(st)
    return inner
  }
  if (tok.t === 'id') {
    if (peek(st)?.t === 'lp') {
      take(st)
      const args = parseArgs(st, ctx)
      if (!args.ok) return args
      if (peek(st)?.t !== 'rp') return { ok: false, error: 'Missing ")" after function call.' }
      take(st)
      const vals = args.values ?? []
      switch (tok.v) {
        case 'sum':
          return { ok: true, value: vals.reduce((a, b) => a + b, 0) }
        case 'min':
          if (!vals.length) return { ok: false, error: 'min() needs arguments.' }
          return { ok: true, value: Math.min(...vals) }
        case 'max':
          if (!vals.length) return { ok: false, error: 'max() needs arguments.' }
          return { ok: true, value: Math.max(...vals) }
        case 'abs':
          if (vals.length !== 1) return { ok: false, error: 'abs() takes one argument.' }
          return { ok: true, value: Math.abs(vals[0]!) }
        case 'round': {
          if (vals.length < 1 || vals.length > 2) {
            return { ok: false, error: 'round(value[, digits]) takes 1–2 args.' }
          }
          const digits = vals[1] ?? 0
          const f = 10 ** Math.max(0, Math.min(8, Math.floor(digits)))
          return { ok: true, value: Math.round(vals[0]! * f) / f }
        }
        default:
          return { ok: false, error: `Unknown function "${tok.v}".` }
      }
    }
    const n = toNumber(ctx[tok.v])
    if (!Number.isFinite(n)) {
      // Missing / non-numeric refs → 0 so sums stay usable; comparisons still work via == 0.
      return { ok: true, value: 0 }
    }
    return { ok: true, value: n }
  }
  return { ok: false, error: 'Expected a value.' }
}

/** Evaluate a math / comparison expression against field values. */
export function evaluateFormExpression(source: string, ctx: FormExprContext): FormExprResult {
  const toks = tokenize(source)
  if ('error' in toks) return { ok: false, error: toks.error }
  const st: ParseState = { toks, i: 0 }
  const result = parseExpr(st, ctx)
  if (!result.ok) return result
  if (st.i < st.toks.length) return { ok: false, error: 'Unexpected trailing tokens.' }
  return result
}

export function formatComputedNumber(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return ''
  const p = Math.max(0, Math.min(8, Math.floor(precision)))
  return value.toFixed(p).replace(/\.?0+$/, (m) => (m.startsWith('.') ? '' : m))
}

/** Prefer fixed decimals for money-like computed fields. */
export function formatComputedFixed(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return ''
  const p = Math.max(0, Math.min(8, Math.floor(precision)))
  return value.toFixed(p)
}

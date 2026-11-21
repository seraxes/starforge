import { sanitizeCssColor } from '@/core/modules/styles'

import type { StarforgeAtomDefinition } from '../types'

export type HeadroomMode = 'sticky' | 'headroom'

/** How `target` is interpreted — bare tokens only (no `#` / `.` in admin inputs). */
export type HeadroomTargetKind = 'section' | 'id' | 'class'

export type HeadroomConfig = {
  mode: HeadroomMode
  targetKind: HeadroomTargetKind
  /** Bare layout section id, HTML id, or CSS class name (no `#` / `.`). */
  target: string
  /**
   * Background at rest (scroll top). Hex `#rgb` / `#rrggbb` / `#rrggbbaa`
   * (last two digits = opacity). Empty = leave alone.
   */
  backgroundDefault: string
  /**
   * Background when scrolled / over page content. Same hex forms as default
   * (`#rrggbbaa` for opacity). Empty = leave alone.
   */
  backgroundScrolled: string
  offset: number
  tolerance: number
  zIndex: number
}

function asNumber(raw: unknown, fallback: number, min = 0, max = 99999): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function asTargetKind(raw: unknown): HeadroomTargetKind | null {
  if (raw === 'section' || raw === 'id' || raw === 'class') return raw
  return null
}

/**
 * Normalize legacy free-selector targets (`#nav`, `.header`) into kind + bare token.
 * Prefer explicit `targetKind` when present.
 */
export function normalizeHeadroomTarget(
  raw: Record<string, unknown>,
): { targetKind: HeadroomTargetKind; target: string } {
  const explicitKind = asTargetKind(raw.targetKind)
  const fromTarget = typeof raw.target === 'string' ? raw.target.trim() : ''
  const fromSection = typeof raw.sectionId === 'string' ? raw.sectionId.trim() : ''
  const source = fromTarget || fromSection

  if (explicitKind) {
    const bare = source.replace(/^[#.]+/, '').trim()
    return { targetKind: explicitKind, target: bare }
  }

  if (source.startsWith('#')) {
    return { targetKind: 'id', target: source.slice(1).trim() }
  }
  if (source.startsWith('.')) {
    return { targetKind: 'class', target: source.slice(1).trim() }
  }
  // Bare token — layout section id (`data-sf-section`), same as Layout’s stable id.
  return { targetKind: 'section', target: source }
}

/** Expand 3/6-digit hex to 6-digit RGB (no alpha). */
function expandHexRgb(hex: string): string | null {
  const h = hex.replace(/^#/, '').toLowerCase()
  if (h.length === 3) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`
  }
  if (h.length === 6) return `#${h}`
  if (h.length === 4) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`
  }
  if (h.length === 8) return `#${h.slice(0, 6)}`
  return null
}

/**
 * Legacy: bake separate opacity % into `#rrggbbaa` when the stored color has no alpha.
 * No-op when color already includes alpha digits.
 */
function colorWithLegacyOpacity(rawColor: unknown, rawOpacity: unknown): string {
  const color = sanitizeCssColor(rawColor) ?? ''
  if (!color || color === 'transparent') return color
  if (color.length === 5 || color.length === 9) return color
  if (rawOpacity === undefined || rawOpacity === null || rawOpacity === '') return color
  const pct = asNumber(rawOpacity, 100, 0, 100)
  if (pct >= 100) return color
  const rgb = expandHexRgb(color)
  if (!rgb) return color
  const aa = Math.round((pct / 100) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${rgb}${aa}`
}

/** Alpha 0–100 from `#rgb(a)` / `#rrggbb(aa)`. Empty / missing alpha → 100. */
export function hexAlphaPercent(raw: string | undefined | null): number {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (!trimmed) return 100
  const color = sanitizeCssColor(trimmed) ?? ''
  if (!color) return 100
  if (color === 'transparent') return 0
  let aa = 'ff'
  if (color.length === 9) aa = color.slice(7, 9)
  else if (color.length === 5) aa = `${color[4]}${color[4]}`
  else return 100
  const n = parseInt(aa, 16)
  if (!Number.isFinite(n)) return 100
  return Math.round((n / 255) * 100)
}

/**
 * Native `<input type="color">` only returns `#rrggbb`. Keep prior alpha digits
 * when the swatch changes (`#rrggbb` + existing `aa` → `#rrggbbaa`).
 */
export function mergeHexRgbPreservingAlpha(nextRgb: string, previous: string): string {
  const rgb = expandHexRgb(sanitizeCssColor(nextRgb) ?? nextRgb.trim())
  if (!rgb) return (sanitizeCssColor(nextRgb) ?? '').trim()
  const prev = sanitizeCssColor(previous) ?? ''
  let aa = 'ff'
  if (prev.length === 9) aa = prev.slice(7, 9)
  else if (prev.length === 5) aa = `${prev[4]}${prev[4]}`
  else return rgb
  return `${rgb}${aa}`
}

/**
 * Set opacity on a hex color via slider (0–100). Empty color → `#ffffff` + alpha
 * so the slider can still paint a translucent white until a swatch is chosen.
 */
export function mergeHexAlphaPercent(previous: string, opacityPercent: number): string {
  const pct = Math.min(100, Math.max(0, Math.round(opacityPercent)))
  const aa = Math.round((pct / 100) * 255)
    .toString(16)
    .padStart(2, '0')
  const prev = sanitizeCssColor(previous) ?? ''
  if (!prev || prev === 'transparent') {
    return pct >= 100 ? '' : `#ffffff${aa}`
  }
  const rgb = expandHexRgb(prev)
  if (!rgb) return prev
  if (pct >= 100) return rgb
  return `${rgb}${aa}`
}

function asConfig(raw: Record<string, unknown>): HeadroomConfig {
  const mode: HeadroomMode = raw.mode === 'headroom' ? 'headroom' : 'sticky'
  const { targetKind, target } = normalizeHeadroomTarget(raw)
  return {
    mode,
    targetKind,
    target,
    backgroundDefault: colorWithLegacyOpacity(
      raw.backgroundDefault,
      raw.backgroundDefaultOpacity,
    ),
    backgroundScrolled: colorWithLegacyOpacity(
      raw.backgroundScrolled,
      raw.backgroundScrolledOpacity,
    ),
    offset: asNumber(raw.offset, 0, 0, 2000),
    tolerance: asNumber(raw.tolerance, 5, 0, 500),
    zIndex: asNumber(raw.zIndex, 100, 0, 2147483647),
  }
}

function escapeCssAttr(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function escapeJsString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')
}

function escapeCssIdent(value: string): string | null {
  const t = value.trim()
  if (!t || t.length > 100) return null
  if (!/^[A-Za-z_][\w-]*$/.test(t)) return null
  return t
}

/**
 * Build a CSS selector from bare admin tokens. Prefixes are added only here.
 */
export function resolveHeadroomSelector(
  targetKind: HeadroomTargetKind,
  target: string,
): string | null {
  const bare = target.trim().replace(/^[#.]+/, '')
  if (!bare) return null

  if (targetKind === 'section') {
    if (!/^[a-zA-Z0-9_-]+$/.test(bare)) return null
    return `[data-sf-section="${escapeCssAttr(bare)}"]`
  }

  const ident = escapeCssIdent(bare)
  if (!ident) return null
  return targetKind === 'id' ? `#${ident}` : `.${ident}`
}

function backgroundCss(
  selector: string,
  backgroundDefault: string,
  backgroundScrolled: string,
): string {
  const parts: string[] = []
  if (backgroundDefault || backgroundScrolled) {
    parts.push(
      `${selector}{transition:background-color .25s ease,transform .25s ease,opacity .25s ease;}`,
    )
  }
  if (backgroundDefault) {
    parts.push(`${selector}.sf-headroom--top{background-color:${backgroundDefault};}`)
  }
  if (backgroundScrolled) {
    parts.push(`${selector}.sf-headroom--scrolled{background-color:${backgroundScrolled};}`)
  }
  return parts.join('')
}

function stickyCss(selector: string, config: HeadroomConfig): string {
  const base = `${selector}{position:sticky;top:${config.offset}px;z-index:${config.zIndex};}`
  return base + backgroundCss(selector, config.backgroundDefault, config.backgroundScrolled)
}

function headroomCss(selector: string, config: HeadroomConfig): string {
  return [
    `${selector}{position:sticky;top:${config.offset}px;z-index:${config.zIndex};transition:transform .25s ease,opacity .25s ease,background-color .25s ease;will-change:transform;}`,
    `${selector}.sf-headroom--pinned{transform:translateY(0);opacity:1;}`,
    `${selector}.sf-headroom--unpinned{transform:translateY(calc(-100% - ${config.offset}px));opacity:0;pointer-events:none;}`,
    backgroundCss(selector, config.backgroundDefault, config.backgroundScrolled),
  ].join('')
}

/**
 * Scroll listener: always toggles top/scrolled for backgrounds.
 * Headroom mode also pin/unpins on scroll direction.
 */
function runtimeScript(selector: string, tolerance: number, headroomMode: boolean): string {
  const sel = escapeJsString(selector)
  return `(function(){
var SEL='${sel}';
var TOL=${tolerance};
var HEADROOM=${headroomMode ? 'true' : 'false'};
var el=document.querySelector(SEL);
if(!el||window.__sfHeadroomBound)return;
window.__sfHeadroomBound=true;
el.classList.add('sf-headroom','sf-headroom--top','sf-headroom--pinned');
var last=window.scrollY||0;
var acc=0;
function setTop(atTop){
  if(atTop){
    el.classList.add('sf-headroom--top');
    el.classList.remove('sf-headroom--scrolled');
  }else{
    el.classList.add('sf-headroom--scrolled');
    el.classList.remove('sf-headroom--top');
  }
}
function onScroll(){
  var y=window.scrollY||0;
  setTop(y<=0);
  if(!HEADROOM){last=y;return;}
  var dy=y-last;
  if((dy>0&&acc<0)||(dy<0&&acc>0))acc=0;
  acc+=dy;
  last=y;
  if(y<=0){
    el.classList.add('sf-headroom--pinned');
    el.classList.remove('sf-headroom--unpinned');
    acc=0;
    return;
  }
  if(acc>TOL){
    el.classList.add('sf-headroom--unpinned');
    el.classList.remove('sf-headroom--pinned');
    acc=0;
  }else if(acc<-TOL){
    el.classList.add('sf-headroom--pinned');
    el.classList.remove('sf-headroom--unpinned');
    acc=0;
  }
}
window.addEventListener('scroll',onScroll,{passive:true});
onScroll();
})();`
}

/** Atom: pin one element as sticky or headroom (hide on scroll down). */
export const headroomAtom: StarforgeAtomDefinition = {
  type: 'headroom',
  label: 'Sticky / Headroom',
  description:
    'Make one section, HTML id, or CSS class sticky — or headroom (hide on scroll down, show on scroll up).',
  requiresDeveloperAdmin: true,
  defaultConfig: () => ({
    mode: 'sticky',
    targetKind: 'id',
    target: '',
    backgroundDefault: '',
    backgroundScrolled: '',
    offset: 0,
    tolerance: 5,
    zIndex: 100,
  }),
  inject: (raw) => {
    const config = asConfig(raw)
    const selector = resolveHeadroomSelector(config.targetKind, config.target)
    if (!selector) return []

    const out: ReturnType<StarforgeAtomDefinition['inject']> = []
    const headroomMode = config.mode === 'headroom'

    out.push({
      target: 'head',
      html: `<style data-sf-atom="headroom">${
        headroomMode ? headroomCss(selector, config) : stickyCss(selector, config)
      }</style>`,
    })
    out.push({
      target: 'body-end',
      html: `<script data-sf-atom="headroom">${runtimeScript(
        selector,
        config.tolerance,
        headroomMode,
      )}</script>`,
    })
    return out
  },
}

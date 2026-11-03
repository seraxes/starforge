import type { StarforgeAtomDefinition } from '../types'

export type AnalyticsConfig = {
  /** Measurement / property id (e.g. G-XXXX or UA-XXXX). */
  measurementId?: string
  provider?: 'google' | 'generic'
  /**
   * Injected by document-shell when product:consent is on.
   * Not an admin field — gates gtag until sf-consent.analytics is true.
   */
  consentGate?: boolean
}

function asConfig(raw: Record<string, unknown>): AnalyticsConfig {
  return {
    measurementId: typeof raw.measurementId === 'string' ? raw.measurementId.trim() : '',
    provider: raw.provider === 'generic' ? 'generic' : 'google',
    consentGate: raw.consentGate === true,
  }
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function escapeJsString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')
}

/** Immediate Google gtag inject (no consent gate). */
function googleImmediate(safeId: string): string {
  return [
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${safeId}"></script>`,
    `<script data-sf-atom="analytics">window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${safeId}');</script>`,
  ].join('\n')
}

/**
 * Consent-aware Google loader: waits for sf-consent cookie / sf-consent-change.
 * Cookie name stays aligned with CONSENT_COOKIE_NAME / CONSENT_EVENT in core/consent.
 */
function googleConsentGated(jsId: string): string {
  return `<script data-sf-atom="analytics" data-sf-consent-gate="1">(function(){
var ID='${jsId}';
var COOKIE='sf-consent';
var EVT='sf-consent-change';
function allowed(){
  try{
    var m=document.cookie.match(new RegExp('(?:^|; )'+COOKIE+'=([^;]*)'));
    if(!m)return false;
    var p=JSON.parse(decodeURIComponent(m[1]));
    return p&&p.analytics===true;
  }catch(e){return false;}
}
function load(){
  if(!allowed()||window.__sfAnalyticsLoaded)return;
  window.__sfAnalyticsLoaded=true;
  var s=document.createElement('script');
  s.async=true;
  s.src='https://www.googletagmanager.com/gtag/js?id='+ID;
  document.head.appendChild(s);
  window.dataLayer=window.dataLayer||[];
  function gtag(){dataLayer.push(arguments);}
  window.gtag=gtag;
  gtag('js',new Date());
  gtag('config',ID);
}
load();
window.addEventListener(EVT,load);
})();</script>`
}

/** Atom: Google Analytics (gtag) or generic measurement id snippet. */
export const analyticsAtom: StarforgeAtomDefinition = {
  type: 'analytics',
  label: 'Analytics',
  description: 'Google Analytics (gtag) or a generic measurement id.',
  requiresDeveloperAdmin: true,
  defaultConfig: () => ({ measurementId: '', provider: 'google' }),
  inject: (raw) => {
    const config = asConfig(raw)
    const id = config.measurementId
    if (!id) return []

    if (config.provider === 'generic') {
      // Meta tag only — still emit when gated; no third-party script.
      return [
        {
          target: 'head',
          html: `<meta name="sf-analytics-id" content="${escapeAttr(id)}" />`,
        },
      ]
    }

    const safeId = escapeAttr(id)
    const jsId = escapeJsString(id)

    if (config.consentGate) {
      return [
        {
          target: 'head',
          html: googleConsentGated(jsId),
        },
      ]
    }

    return [
      {
        target: 'head',
        html: googleImmediate(safeId),
      },
    ]
  },
}

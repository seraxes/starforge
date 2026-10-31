import type { StarforgeAtomDefinition } from '../types'

export type CustomCssJsConfig = {
  css?: string
  javascript?: string
}

function asConfig(raw: Record<string, unknown>): CustomCssJsConfig {
  return {
    css: typeof raw.css === 'string' ? raw.css : '',
    javascript: typeof raw.javascript === 'string' ? raw.javascript : '',
  }
}

/** Atom: inject custom CSS (head) + JS (body end). JS = developer-admin. */
export const customCssJsAtom: StarforgeAtomDefinition = {
  type: 'custom-css-js',
  label: 'Custom CSS / JS',
  description: 'Inline stylesheet in head and optional script before </body>.',
  requiresDeveloperAdmin: true,
  defaultConfig: () => ({ css: '', javascript: '' }),
  inject: (raw) => {
    const config = asConfig(raw)
    const out: ReturnType<StarforgeAtomDefinition['inject']> = []
    const css = config.css?.trim()
    if (css) {
      out.push({
        target: 'head',
        html: `<style data-sf-atom="custom-css-js">${css}</style>`,
      })
    }
    const js = config.javascript?.trim()
    if (js) {
      out.push({
        target: 'body-end',
        html: `<script data-sf-atom="custom-css-js">${js}</script>`,
      })
    }
    return out
  },
}

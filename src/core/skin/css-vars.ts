import { skinBodySelector } from './css-scope'
import type { SkinTokens } from './types'

/** Emit `body.sf-skin-{id} { … }` custom properties for the active skin. */
export function buildSkinRootCss(skinId: string, tokens: SkinTokens): string {
  const lines = [
    `--sf-primary: ${tokens.primary};`,
    `--sf-primary-strong: ${tokens.primaryStrong};`,
    `--sf-primary-ink: ${tokens.primaryInk};`,
    `--sf-secondary: ${tokens.secondary};`,
    `--sf-secondary-strong: ${tokens.secondaryStrong};`,
    `--sf-secondary-ink: ${tokens.secondaryInk};`,
    `--sf-ink: ${tokens.ink};`,
    `--sf-muted: ${tokens.muted};`,
    `--sf-paper: ${tokens.paper};`,
    `--sf-line: ${tokens.line};`,
    `--sf-accent: ${tokens.accent};`,
    `--sf-accent-ink: ${tokens.accentInk};`,
    `--font-display: ${tokens.fontDisplay};`,
    `--font-body: ${tokens.fontBody};`,
  ]
  const sel = skinBodySelector(skinId)
  return `${sel} {\n  ${lines.join('\n  ')}\n}`
}

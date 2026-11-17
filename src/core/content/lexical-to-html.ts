/**
 * One-shot Lexical JSON → HTML for page bodies.
 * TipTap HTML passes through. Public render does not import Payload.
 */

import { barePathForSlug, type RootPageSlug } from '@/core/nav/root-target'

const BOLD = 1
const ITALIC = 2
const STRIKE = 4
const UNDERLINE = 8
const CODE = 16

type LexicalNode = {
  type?: string
  text?: string
  format?: number
  tag?: string
  listType?: string
  url?: string
  fields?: {
    url?: string
    newTab?: boolean
    doc?: { value?: { slug?: string } | number | string | null } | null
  }
  children?: LexicalNode[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isLexicalState(value: unknown): value is { root: LexicalNode } {
  if (!isRecord(value)) return false
  const root = value.root
  return isRecord(root)
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;')
}

function safeHref(raw: string): string {
  const href = raw.trim()
  if (!href || href.length > 2000) return ''
  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('mailto:')) return href
  if (/^https?:\/\//i.test(href)) return href
  return ''
}

function linkHref(node: LexicalNode, rootPageSlug?: RootPageSlug): string {
  const fields = node.fields
  const fromField = typeof fields?.url === 'string' ? fields.url : ''
  const fromNode = typeof node.url === 'string' ? node.url : ''
  const direct = safeHref(fromField || fromNode)
  if (direct) return direct
  const value = fields?.doc?.value
  if (value && typeof value === 'object' && typeof value.slug === 'string') {
    const slug = value.slug.trim()
    if (!slug) return ''
    return safeHref(barePathForSlug(slug, rootPageSlug))
  }
  return ''
}

function wrapText(text: string, format: number): string {
  let out = escapeText(text)
  if (format & CODE) out = `<code>${out}</code>`
  if (format & BOLD) out = `<strong>${out}</strong>`
  if (format & ITALIC) out = `<em>${out}</em>`
  if (format & UNDERLINE) out = `<u>${out}</u>`
  if (format & STRIKE) out = `<s>${out}</s>`
  return out
}

function renderChildren(nodes: LexicalNode[] | undefined, rootPageSlug?: RootPageSlug): string {
  if (!nodes || nodes.length === 0) return ''
  return nodes.map((node) => renderNode(node, rootPageSlug)).join('')
}

function renderNode(node: LexicalNode, rootPageSlug?: RootPageSlug): string {
  const type = node.type ?? ''
  if (type === 'text') {
    return wrapText(typeof node.text === 'string' ? node.text : '', node.format ?? 0)
  }
  if (type === 'linebreak') return '<br>'
  if (type === 'horizontalrule') return '<hr>'
  if (type === 'tab') return ' '
  if (type === 'paragraph' || type === 'root') {
    const inner = renderChildren(node.children, rootPageSlug)
    if (type === 'root') return inner
    return inner ? `<p>${inner}</p>` : ''
  }
  if (type === 'heading') {
    const tag = node.tag === 'h1' || node.tag === 'h2' || node.tag === 'h3' || node.tag === 'h4'
      ? node.tag
      : 'h2'
    const inner = renderChildren(node.children, rootPageSlug)
    return inner ? `<${tag}>${inner}</${tag}>` : ''
  }
  if (type === 'quote') {
    const inner = renderChildren(node.children, rootPageSlug)
    return inner ? `<blockquote>${inner}</blockquote>` : ''
  }
  if (type === 'list') {
    const tag = node.listType === 'number' ? 'ol' : 'ul'
    const inner = renderChildren(node.children, rootPageSlug)
    return inner ? `<${tag}>${inner}</${tag}>` : ''
  }
  if (type === 'listitem') {
    const inner = renderChildren(node.children, rootPageSlug)
    return inner ? `<li>${inner}</li>` : ''
  }
  if (type === 'link' || type === 'autolink') {
    const inner = renderChildren(node.children, rootPageSlug)
    const href = linkHref(node, rootPageSlug)
    if (!inner) return ''
    if (!href) return inner
    const target = node.fields?.newTab ? ' target="_blank" rel="noopener noreferrer"' : ''
    return `<a href="${escapeAttr(href)}"${target}>${inner}</a>`
  }
  if (node.children && node.children.length > 0) return renderChildren(node.children, rootPageSlug)
  return ''
}

function lexicalToHtml(state: { root: LexicalNode }, rootPageSlug?: RootPageSlug): string {
  return renderNode(state.root, rootPageSlug).trim()
}

/**
 * Page body for storage and public render.
 * Lexical editor state (object or JSON text) becomes HTML. Anything else
 * is returned as text, which is the TipTap HTML path.
 */
export function pageBodyToHtml(data: unknown, options?: { rootPageSlug?: RootPageSlug }): string {
  const rootPageSlug = options?.rootPageSlug
  if (data == null) return ''
  if (typeof data === 'string') {
    const trimmed = data.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('{')) {
      try {
        const parsed: unknown = JSON.parse(trimmed)
        if (isLexicalState(parsed)) return lexicalToHtml(parsed, rootPageSlug)
      } catch {
        return trimmed
      }
    }
    return trimmed
  }
  if (isLexicalState(data)) return lexicalToHtml(data, rootPageSlug)
  return ''
}

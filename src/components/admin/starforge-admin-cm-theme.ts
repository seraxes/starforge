/**
 * CodeMirror 6 theme aligned with Core admin Gantry chrome
 * (dark navy panels, mid-blue accents, orange only for string tokens).
 */
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

const BG = '#0f1a2a'
const GUTTER_BG = '#0c1522'
const BORDER = '#1e4d72'
const INK = '#e8eef8'
const MUTED = '#8fa3bc'
const BLUE_MID = '#3498db'
const BLUE_SOFT = '#8ebad4'
const BLUE_LIGHT = '#b7d6ec'
const ACTIVE = 'rgba(52, 152, 219, 0.14)'
const SELECTION = 'rgba(52, 152, 219, 0.28)'
const ORANGE = '#ef9550'

const starforgeAdminEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: BG,
      color: INK,
    },
    '.cm-content': {
      caretColor: '#ffffff',
      fontFamily:
        "ui-monospace, 'Cascadia Code', 'Segoe UI Mono', Menlo, Consolas, monospace",
      fontSize: '0.85rem',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: BLUE_MID,
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: SELECTION,
      },
    '.cm-activeLine': {
      backgroundColor: ACTIVE,
    },
    '.cm-gutters': {
      backgroundColor: GUTTER_BG,
      color: MUTED,
      border: 'none',
      borderRight: `1px solid ${BORDER}`,
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#152436',
      color: '#cfe3f7',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: '#152436',
      border: `1px solid ${BORDER}`,
      color: BLUE_SOFT,
    },
    '.cm-tooltip': {
      backgroundColor: '#1b2432',
      border: `1px solid ${BORDER}`,
      color: INK,
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: BLUE_MID,
      color: '#fff',
    },
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: 'rgba(52, 152, 219, 0.22)',
      outline: `1px solid ${BORDER}`,
    },
  },
  { dark: true },
)

const starforgeAdminHighlight = HighlightStyle.define([
  { tag: t.keyword, color: BLUE_MID },
  { tag: t.controlKeyword, color: BLUE_MID },
  { tag: t.operatorKeyword, color: BLUE_SOFT },
  { tag: t.definitionKeyword, color: BLUE_LIGHT },
  { tag: t.moduleKeyword, color: BLUE_MID },
  { tag: t.string, color: ORANGE },
  { tag: t.special(t.string), color: ORANGE },
  { tag: t.character, color: ORANGE },
  { tag: t.number, color: BLUE_LIGHT },
  { tag: t.bool, color: BLUE_LIGHT },
  { tag: t.null, color: BLUE_LIGHT },
  { tag: t.comment, color: MUTED, fontStyle: 'italic' },
  { tag: t.lineComment, color: MUTED, fontStyle: 'italic' },
  { tag: t.blockComment, color: MUTED, fontStyle: 'italic' },
  { tag: t.propertyName, color: BLUE_SOFT },
  { tag: t.attributeName, color: BLUE_SOFT },
  { tag: t.variableName, color: INK },
  { tag: t.definition(t.variableName), color: '#cfe3f7' },
  { tag: t.function(t.variableName), color: BLUE_LIGHT },
  { tag: t.className, color: BLUE_LIGHT },
  { tag: t.typeName, color: BLUE_LIGHT },
  { tag: t.tagName, color: BLUE_MID },
  { tag: t.angleBracket, color: MUTED },
  { tag: t.operator, color: MUTED },
  { tag: t.punctuation, color: MUTED },
  { tag: t.bracket, color: MUTED },
  { tag: t.meta, color: MUTED },
  { tag: t.invalid, color: '#e07474' },
])

/** Extensions: dark navy editor chrome + mid-blue syntax (not One Dark purple). */
export const starforgeAdminCmTheme: Extension[] = [
  starforgeAdminEditorTheme,
  syntaxHighlighting(starforgeAdminHighlight),
]

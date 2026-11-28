/**
 * Insert a string at the caret (or replacing the selection) in a text field.
 * Used by EmojiInsertButton for uncontrolled inputs/textareas.
 */

export type TextCaretTarget = HTMLInputElement | HTMLTextAreaElement

export type InsertTextAtCaretResult = {
  value: string
  caret: number
}

/** Pure splice — for controlled React state + caret restore. */
export function insertTextIntoValue(
  value: string,
  text: string,
  selectionStart: number,
  selectionEnd: number = selectionStart,
): InsertTextAtCaretResult {
  const start = Math.max(0, Math.min(selectionStart, value.length))
  const end = Math.max(start, Math.min(selectionEnd, value.length))
  const next = value.slice(0, start) + text + value.slice(end)
  return { value: next, caret: start + text.length }
}

/**
 * Write into the DOM field, restore the caret, and dispatch `input`
 * so uncontrolled React forms and listeners see the change.
 */
export function insertTextAtCaret(el: TextCaretTarget, text: string): InsertTextAtCaretResult {
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? start
  const result = insertTextIntoValue(el.value, text, start, end)
  el.value = result.value
  el.setSelectionRange(result.caret, result.caret)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.focus()
  return result
}

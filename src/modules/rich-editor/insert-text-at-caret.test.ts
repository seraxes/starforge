import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { insertTextAtCaret, insertTextIntoValue } from './insert-text-at-caret'

describe('insertTextIntoValue', () => {
  it('inserts in the middle', () => {
    assert.deepEqual(insertTextIntoValue('ab', '😀', 1, 1), {
      value: 'a😀b',
      caret: 3,
    })
  })

  it('inserts at the end', () => {
    assert.deepEqual(insertTextIntoValue('hi', '!', 2, 2), {
      value: 'hi!',
      caret: 3,
    })
  })

  it('inserts into empty', () => {
    assert.deepEqual(insertTextIntoValue('', '👋', 0, 0), {
      value: '👋',
      caret: 2,
    })
  })

  it('replaces a selection', () => {
    assert.deepEqual(insertTextIntoValue('hello', 'X', 1, 4), {
      value: 'hXo',
      caret: 2,
    })
  })

  it('clamps out-of-range caret', () => {
    assert.deepEqual(insertTextIntoValue('ab', '!', 99, 99), {
      value: 'ab!',
      caret: 3,
    })
  })
})

describe('insertTextAtCaret', () => {
  it('updates an input value and caret', () => {
    const el = {
      value: 'ab',
      selectionStart: 1 as number | null,
      selectionEnd: 1 as number | null,
      setSelectionRange(start: number, end: number) {
        el.selectionStart = start
        el.selectionEnd = end
      },
      focus() {},
      dispatchEvent() {
        return true
      },
    }

    const result = insertTextAtCaret(el as unknown as HTMLInputElement, '😀')
    assert.equal(result.value, 'a😀b')
    assert.equal(result.caret, 3)
    assert.equal(el.value, 'a😀b')
    assert.equal(el.selectionStart, 3)
  })
})

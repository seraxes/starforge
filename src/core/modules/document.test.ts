import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  cloneWorkingLayoutDocument,
  layoutDocumentIsStored,
  parseLayoutDocumentJson,
  sanitizeCssClassList,
  sanitizeHtmlId,
  slugifyLayoutId,
} from './document'

describe('layout document helpers', () => {
  it('slugifies labels', () => {
    assert.equal(slugifyLayoutId('Base Outline'), 'base-outline')
    assert.equal(slugifyLayoutId('!!!'), 'untitled')
  })

  it('sanitizes css class lists', () => {
    assert.equal(sanitizeCssClassList('hero primary 1bad'), 'hero primary')
    assert.equal(sanitizeCssClassList(''), undefined)
  })

  it('sanitizes html ids', () => {
    assert.equal(sanitizeHtmlId('main-nav'), 'main-nav')
    assert.equal(sanitizeHtmlId('1bad'), undefined)
  })

  it('preserves empty inheriting stubs when cloning for mutate', () => {
    const child = {
      version: 3 as const,
      inheritFrom: 'starforge-pastel-default',
      sections: [] as [],
    }
    const working = cloneWorkingLayoutDocument(child)
    assert.equal(working.inheritFrom, 'starforge-pastel-default')
    assert.equal(working.sections.length, 0)
    assert.notEqual(working, child)
  })

  it('keeps an empty inherit stub loadable after save/parse', () => {
    const stub = {
      version: 3 as const,
      inheritFrom: 'starforge-pastel-default',
      sections: [] as [],
    }
    assert.equal(layoutDocumentIsStored(stub), true)
    const parsed = parseLayoutDocumentJson(JSON.stringify(stub))
    assert.ok(parsed)
    assert.equal(parsed.inheritFrom, 'starforge-pastel-default')
    assert.equal(parsed.sections.length, 0)
    assert.equal(layoutDocumentIsStored(parsed), true)
  })

  it('does not treat a blank outline as a stored document', () => {
    assert.equal(layoutDocumentIsStored({ version: 3, sections: [] }), false)
    assert.equal(layoutDocumentIsStored(null), false)
    assert.equal(layoutDocumentIsStored(undefined), false)
  })

  it('keeps a row container through parse', () => {
    const parsed = parseLayoutDocumentJson(
      JSON.stringify({
        version: 3,
        sections: [
          { id: 'left', label: 'Left', width: 20, order: 0, rows: [] },
          { id: 'right', label: 'Right', width: 80, order: 1, rows: [] },
        ],
        rowContainers: [
          {
            id: 'rowc-main',
            label: 'Columns',
            sectionIds: ['left', 'right'],
            containerMode: 'boxed',
            htmlId: 'g-columns',
            cssClass: 'band',
            styles: { backgroundColor: '#112233' },
          },
          { id: 'bad id', label: 'Skip', sectionIds: ['left'] },
        ],
      }),
    )
    assert.ok(parsed)
    assert.equal(parsed.rowContainers?.length, 1)
    assert.equal(parsed.rowContainers?.[0]?.id, 'rowc-main')
    assert.equal(parsed.rowContainers?.[0]?.containerMode, 'boxed')
    assert.equal(parsed.rowContainers?.[0]?.htmlId, 'g-columns')
    assert.equal(parsed.rowContainers?.[0]?.styles?.backgroundColor, '#112233')
    assert.deepEqual(parsed.rowContainers?.[0]?.sectionIds, ['left', 'right'])
  })

  it('treats a copied section snapshot as a stored document', () => {
    assert.equal(
      layoutDocumentIsStored({
        version: 3,
        sections: [{ id: 'main', label: 'Main', order: 0, rows: [] }],
      }),
      true,
    )
  })
})

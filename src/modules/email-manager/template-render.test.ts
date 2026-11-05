import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  listMergeFieldsInTemplate,
  renderEmailTemplate,
  renderEmailTemplateString,
} from './template-render'

describe('renderEmailTemplateString', () => {
  it('merges nested and flat paths', () => {
    const out = renderEmailTemplateString(
      'Hi {{formTitle}} / {{payload.email}}',
      { formTitle: 'Contact', payload: { email: 'a@b.c' } },
    )
    assert.equal(out, 'Hi Contact / a@b.c')
  })

  it('replaces missing tokens with empty string', () => {
    assert.equal(renderEmailTemplateString('X{{missing}}Y', {}), 'XY')
  })

  it('stringifies objects for payload dumps', () => {
    const out = renderEmailTemplateString('{{payload}}', {
      payload: { a: 1 },
    })
    assert.match(out, /"a": 1/)
  })
})

describe('renderEmailTemplate', () => {
  it('renders subject text and optional html', () => {
    const rendered = renderEmailTemplate({
      subject: '[SF] {{formTitle}}',
      bodyText: 'Body {{formTitle}}',
      bodyHtml: '<p>{{formTitle}}</p>',
      payload: { formTitle: 'Hello' },
    })
    assert.equal(rendered.subject, '[SF] Hello')
    assert.equal(rendered.text, 'Body Hello')
    assert.equal(rendered.html, '<p>Hello</p>')
  })

  it('defaults empty subject', () => {
    const rendered = renderEmailTemplate({
      subject: '   ',
      bodyText: 'x',
      payload: {},
    })
    assert.equal(rendered.subject, '(no subject)')
  })
})

describe('listMergeFieldsInTemplate', () => {
  it('collects unique sorted paths', () => {
    assert.deepEqual(
      listMergeFieldsInTemplate({
        subject: '{{b}} {{a}}',
        bodyText: '{{a}}',
        bodyHtml: '{{c}}',
      }),
      ['a', 'b', 'c'],
    )
  })
})

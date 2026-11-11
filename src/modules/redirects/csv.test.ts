import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  parseRedirectCsv,
  parseRedirectCsvEnabled,
  parseRedirectCsvStatus,
  validateRedirectCsvRow,
} from './csv'

describe('parseRedirectCsvStatus', () => {
  it('defaults empty to 301', () => {
    assert.equal(parseRedirectCsvStatus(''), 301)
  })

  it('accepts allowed codes', () => {
    assert.equal(parseRedirectCsvStatus('302'), 302)
    assert.equal(parseRedirectCsvStatus('308'), 308)
  })

  it('rejects bad status', () => {
    const bad = parseRedirectCsvStatus('999')
    assert.ok(typeof bad === 'object' && 'error' in bad)
  })
})

describe('parseRedirectCsvEnabled', () => {
  it('defaults empty to true', () => {
    assert.equal(parseRedirectCsvEnabled(''), true)
  })

  it('parses common flags', () => {
    assert.equal(parseRedirectCsvEnabled('0'), false)
    assert.equal(parseRedirectCsvEnabled('yes'), true)
    assert.equal(parseRedirectCsvEnabled('off'), false)
  })

  it('rejects garbage', () => {
    const bad = parseRedirectCsvEnabled('maybe')
    assert.ok(typeof bad === 'object' && 'error' in bad)
  })
})

describe('validateRedirectCsvRow', () => {
  it('normalizes paths like create', () => {
    const row = validateRedirectCsvRow({
      from: '/en/old/',
      to: '/new/',
      status: '301',
      enabled: '1',
      note: 'moved',
    })
    assert.ok(!('error' in row))
    if ('error' in row) return
    assert.equal(row.fromPath, '/old')
    assert.equal(row.toPath, '/new')
    assert.equal(row.statusCode, 301)
    assert.equal(row.enabled, true)
    assert.equal(row.note, 'moved')
  })

  it('rejects same from and to', () => {
    const row = validateRedirectCsvRow({
      from: '/same',
      to: '/same',
      status: '',
      enabled: '',
      note: '',
    })
    assert.ok('error' in row)
  })
})

describe('parseRedirectCsv', () => {
  it('imports two valid rows', () => {
    const csv = [
      'from,to,status,enabled,note',
      '/a,/b,301,1,first',
      '/c,/d,302,0,second',
    ].join('\n')
    const result = parseRedirectCsv(csv)
    assert.ok(!('error' in result))
    if ('error' in result) return
    assert.equal(result.rows.length, 2)
    assert.equal(result.skipped, 0)
    assert.equal(result.rows[0]?.fromPath, '/a')
    assert.equal(result.rows[1]?.statusCode, 302)
    assert.equal(result.rows[1]?.enabled, false)
  })

  it('skips bad status and bad path while keeping valid rows', () => {
    const csv = [
      'from,to,status,enabled,note',
      '/ok,/dest,301,1,good',
      '/bad,/x,999,1,bad-status',
      ',/nowhere,301,1,missing-from',
    ].join('\n')
    const result = parseRedirectCsv(csv)
    assert.ok(!('error' in result))
    if ('error' in result) return
    assert.equal(result.rows.length, 1)
    assert.equal(result.skipped, 2)
    assert.equal(result.rows[0]?.fromPath, '/ok')
  })

  it('requires the expected header columns', () => {
    const result = parseRedirectCsv('from,to\n/a,/b\n')
    assert.ok('error' in result)
  })

  it('handles quoted commas and BOM', () => {
    const csv =
      '\uFEFFfrom,to,status,enabled,note\n"/old,path","/new",301,true,"note, with comma"\n'
    const result = parseRedirectCsv(csv)
    assert.ok(!('error' in result))
    if ('error' in result) return
    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0]?.fromPath, '/old,path')
    assert.equal(result.rows[0]?.note, 'note, with comma')
  })
})

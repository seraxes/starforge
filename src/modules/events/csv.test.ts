import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildRegistrantsCsv, escapeCsvCell } from './csv'

describe('events registrant CSV', () => {
  it('escapes commas and quotes', () => {
    assert.equal(escapeCsvCell('a,b'), '"a,b"')
    assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""')
  })

  it('builds the fixed column set with BOM', () => {
    const csv = buildRegistrantsCsv({
      rows: [
        {
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          ticketType: 'General',
          guests: 2,
          status: 'registered',
          paidAmount: '5000 HUF',
        },
        {
          name: 'Wait Listed',
          email: 'wait@example.com',
          ticketType: '',
          guests: 1,
          status: 'pending_payment',
          paidAmount: '',
        },
      ],
    })
    assert.ok(csv.startsWith('\uFEFF'))
    assert.ok(csv.includes('name,email,ticket type,guests,status,paid amount'))
    assert.ok(
      csv.includes(
        'Ada Lovelace,ada@example.com,General,2,registered,5000 HUF',
      ),
    )
    assert.ok(
      csv.includes('Wait Listed,wait@example.com,,1,pending_payment,'),
    )
  })
})

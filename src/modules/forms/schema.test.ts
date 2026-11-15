import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getTableColumns, getTableName } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'

import {
  FORMS_MODULE_SETTINGS_ID,
  sfFormSettings,
  sfFormSubmissions,
  sfForms,
} from './schema'

function columnNames(table: Parameters<typeof getTableColumns>[0]): string[] {
  return Object.values(getTableColumns(table))
    .map((column) => column.name)
    .sort()
}

describe('forms postgres tables', () => {
  it('keeps the table names that already exist in Postgres', () => {
    assert.equal(getTableName(sfForms), 'sf_forms')
    assert.equal(getTableName(sfFormSubmissions), 'sf_form_submissions')
    assert.equal(getTableName(sfFormSettings), 'sf_form_settings')
    assert.equal(FORMS_MODULE_SETTINGS_ID, 'global')
  })

  it('keeps sf_forms columns', () => {
    assert.deepEqual(columnNames(sfForms), [
      'created_at',
      'document',
      'id',
      'label',
      'preset',
      'updated_at',
    ])
  })

  it('keeps sf_form_settings columns', () => {
    assert.deepEqual(columnNames(sfFormSettings), ['created_at', 'document', 'id', 'updated_at'])
  })

  it('keeps sf_form_submissions columns and indexes', () => {
    assert.deepEqual(columnNames(sfFormSubmissions), [
      'created_at',
      'definition_id',
      'definition_version',
      'fields_snapshot',
      'form_key',
      'id',
      'ip_address',
      'layout_id',
      'payload',
      'slot_id',
      'user_agent',
      'user_id',
    ])
    const { indexes } = getTableConfig(sfFormSubmissions)
    assert.deepEqual(
      indexes.map((index) => index.config.name).sort(),
      [
        'sf_form_submissions_created_at_idx',
        'sf_form_submissions_definition_id_idx',
        'sf_form_submissions_form_key_idx',
        'sf_form_submissions_user_id_idx',
      ],
    )
  })
})

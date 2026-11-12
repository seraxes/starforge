import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildEventCategoryKey,
  contentLocaleFileRefForKey,
  parseContentLocaleKey,
} from '../../core/i18n/content-locale-keys'
import { DEFAULT_EVENT_REGISTRATION_FORM_ID } from '../forms/presets'

import { resolveEventRegistrationFormId } from './registration-form-resolve'

test('event category locale keys parse to the events owner file', () => {
  const key = buildEventCategoryKey('cat-1', 'title')
  assert.equal(key, 'events.category.cat-1.title')
  const parsed = parseContentLocaleKey(key)
  assert.equal(parsed?.kind, 'events-category')
  if (parsed?.kind === 'events-category') {
    assert.equal(parsed.categoryId, 'cat-1')
    assert.equal(parsed.field, 'title')
  }
  assert.deepEqual(contentLocaleFileRefForKey(key), {
    scope: 'events',
    ownerId: 'cat-1',
  })
  assert.equal(parseContentLocaleKey('events.category.cat-1.milsim'), null)
})

test('registration form resolves event, then category, then the shared form', () => {
  assert.equal(
    resolveEventRegistrationFormId({
      eventFormId: 'event-form',
      categoryFormId: 'category-form',
    }),
    'event-form',
  )
  assert.equal(
    resolveEventRegistrationFormId({
      eventFormId: '  ',
      categoryFormId: 'category-form',
    }),
    'category-form',
  )
  assert.equal(
    resolveEventRegistrationFormId({ eventFormId: '', categoryFormId: '' }),
    DEFAULT_EVENT_REGISTRATION_FORM_ID,
  )
})

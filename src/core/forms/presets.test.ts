import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import {
  clearFormPresetRegistrations,
  getRegisteredFormPreset,
  registerFormPreset,
  runFormPresetOnSubmitted,
} from './preset-registry'
import {
  defaultMessagesForPreset,
  fieldsForPreset,
  FORM_PRESETS,
  getFormPresetMeta,
  isFormPresetCategoryId,
  isFormPresetId,
  listFormPresetMetas,
  presetSeedFields,
} from './presets'
import { emptyFormDefinitionDocument } from './definition'
import { fieldsToJsonSchema } from './schema-json'
import type { FormPresetId } from './types'

afterEach(() => {
  clearFormPresetRegistrations()
})

const REAL_PRESETS: FormPresetId[] = [
  'contact',
  'survey',
  'event-registration',
  'voting',
  'ticket',
]

describe('form presets (non-stub seeds)', () => {
  it('marks survey / event-registration / voting as real (no stub flag)', () => {
    for (const id of ['survey', 'event-registration', 'voting'] as const) {
      const meta = getFormPresetMeta(id)
      assert.equal(meta.stub, undefined)
      assert.ok(!FORM_PRESETS.find((p) => p.id === id)?.stub)
    }
  })

  it('exposes every built-in id in admin list + isFormPresetId', () => {
    const ids = listFormPresetMetas().map((p) => p.id)
    for (const id of REAL_PRESETS) {
      assert.ok(ids.includes(id))
      assert.equal(isFormPresetId(id), true)
    }
    assert.equal(isFormPresetId('not-a-preset'), false)
  })

  it('isFormPresetCategoryId accepts known categories only', () => {
    assert.equal(isFormPresetCategoryId('events'), true)
    assert.equal(isFormPresetCategoryId('general'), true)
    assert.equal(isFormPresetCategoryId('support'), true)
    assert.equal(isFormPresetCategoryId('all'), false)
    assert.equal(isFormPresetCategoryId('unknown'), false)
  })

  it('survey seed: rating radio, topics group, feedback textarea', () => {
    const fields = fieldsForPreset('survey')
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]))
    assert.equal(byName.rating?.type, 'radio')
    assert.ok((byName.rating?.options?.length ?? 0) >= 3)
    assert.equal(byName.topics?.type, 'checkbox-group')
    assert.equal(byName.feedback?.type, 'textarea')
    assert.ok(byName.feedback?.stringConstraints?.minLength)
    assert.equal(byName.feedback?.required, true)
  })

  it('event-registration seed: guests bounds, attendance, hidden event_id', () => {
    const fields = fieldsForPreset('event-registration')
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]))
    assert.equal(byName.name?.required, true)
    assert.equal(byName.email?.type, 'email')
    assert.equal(byName.guests?.type, 'number')
    assert.equal(byName.guests?.numberBounds?.min, 1)
    assert.equal(byName.attendance?.type, 'select')
    assert.equal(byName.event_id?.type, 'hidden')
  })

  it('voting seed: required radio choice + hidden poll_id', () => {
    const fields = fieldsForPreset('voting')
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]))
    assert.equal(byName.choice?.type, 'radio')
    assert.equal(byName.choice?.required, true)
    assert.ok((byName.choice?.options?.length ?? 0) >= 2)
    assert.equal(byName.poll_id?.type, 'hidden')
  })

  it('create-from-preset builds a schema-ready definition document', () => {
    for (const preset of REAL_PRESETS) {
      const seed = presetSeedFields(preset)
      assert.equal(seed.preset, preset)
      assert.ok(seed.fields.length > 0)
      const doc = emptyFormDefinitionDocument(preset)
      assert.equal(doc.preset, preset)
      assert.equal(doc.fields.length, seed.fields.length)
      assert.ok(doc.schema.properties)
      const schema = fieldsToJsonSchema(doc.fields, { title: doc.title })
      assert.equal(schema.type, 'object')
      for (const field of doc.fields) {
        if (field.type === 'captcha') continue
        assert.ok(
          schema.properties[field.name],
          `${preset} schema missing ${field.name}`,
        )
      }
      const messages = defaultMessagesForPreset(preset)
      assert.ok(messages.title)
      assert.ok(messages.submitLabel)
      assert.ok(!/stub/i.test(messages.description))
    }
  })
})

describe('registerFormPreset + onSubmitted', () => {
  it('overlays seed fields and messages for a built-in id', () => {
    registerFormPreset({
      id: 'survey',
      label: 'Club survey',
      description: 'Overlay description',
      seedFields: [
        { name: 'score', label: 'Score', type: 'number', required: true },
      ],
      messages: { title: 'Club survey', submitLabel: 'Send score' },
    })
    assert.equal(getFormPresetMeta('survey').label, 'Club survey')
    assert.equal(fieldsForPreset('survey').map((f) => f.name).join(','), 'score')
    assert.equal(defaultMessagesForPreset('survey').submitLabel, 'Send score')
    assert.equal(getRegisteredFormPreset('survey')?.label, 'Club survey')
  })

  it('invokes onSubmitted with submission context', async () => {
    const seen: string[] = []
    registerFormPreset({
      id: 'event-registration',
      label: 'Event registration',
      onSubmitted: async (ctx) => {
        seen.push(`${ctx.presetId}:${ctx.submissionId}:${ctx.payload.name}`)
      },
    })
    await runFormPresetOnSubmitted({
      presetId: 'event-registration',
      definitionId: 'evt-1',
      formKey: 'slot',
      submissionId: 'sub-9',
      userId: null,
      payload: { name: 'Ada' },
    })
    assert.deepEqual(seen, ['event-registration:sub-9:Ada'])
  })

  it('no-ops when preset has no onSubmitted registration', async () => {
    await runFormPresetOnSubmitted({
      presetId: 'voting',
      definitionId: null,
      formKey: 'k',
      submissionId: 's',
      userId: null,
      payload: {},
    })
  })
})

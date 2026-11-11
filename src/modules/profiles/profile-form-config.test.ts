import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createRowDraft,
  fieldsForPreset,
  type FormFieldDef,
  type FormSectionDef,
} from '@/modules/forms/api'

import {
  applyProfileFormConfigToSettings,
  profileFieldKeyFromFormName,
  profileFormConfigFromFields,
  profileFormNameForKey,
} from './profile-form-config'
import { DEFAULT_PROFILES_MODULE_SETTINGS } from './types'

describe('profile form name mapping', () => {
  it('maps snake_case form names to registry keys', () => {
    assert.equal(profileFieldKeyFromFormName('display_name'), 'displayName')
    assert.equal(profileFieldKeyFromFormName('birth_date'), 'birthDate')
    assert.equal(profileFieldKeyFromFormName('displayname'), 'displayName')
    assert.equal(profileFieldKeyFromFormName('bio'), 'bio')
    assert.equal(profileFieldKeyFromFormName('unknown_field'), null)
  })

  it('round-trips known keys to seed names', () => {
    assert.equal(profileFormNameForKey('displayName'), 'display_name')
    assert.equal(profileFormNameForKey('birthDate'), 'birth_date')
    assert.equal(profileFormNameForKey('handle'), 'handle')
  })
})

describe('profileFormConfigFromFields', () => {
  it('enables fields present in the definition and disables missing optional ones', () => {
    const fields: FormFieldDef[] = [
      { name: 'display_name', label: 'Name', type: 'text', required: true },
      { name: 'handle', label: 'Handle', type: 'text', required: true },
      { name: 'avatar', label: 'Photo', type: 'text', required: true },
      { name: 'bio', label: 'About me', type: 'textarea', required: true },
    ]
    const config = profileFormConfigFromFields(fields)
    assert.equal(config.fields.displayName.enabled, true)
    assert.equal(config.fields.handle.enabled, true)
    assert.equal(config.fields.avatar.enabled, true)
    assert.equal(config.fields.bio.enabled, true)
    assert.equal(config.fields.bio.required, true)
    assert.equal(config.fields.bio.label, 'About me')
    assert.equal(config.fields.headline.enabled, false)
    assert.equal(config.fields.cover.enabled, false)
  })

  it('forces locked keys even when omitted from the definition', () => {
    const fields: FormFieldDef[] = [
      { name: 'bio', label: 'Bio', type: 'textarea', required: false },
    ]
    const config = profileFormConfigFromFields(fields)
    assert.equal(config.fields.displayName.enabled, true)
    assert.equal(config.fields.handle.enabled, true)
    assert.equal(config.fields.avatar.enabled, true)
    assert.equal(config.fields.bio.enabled, true)
  })

  it('uses Forms sections for field order and percent width', () => {
    const fields = fieldsForPreset('profile')
    const sections: FormSectionDef[] = [
      {
        id: 'sec_custom',
        label: 'Custom about',
        width: 100,
        rows: [createRowDraft('bio'), createRowDraft('headline')],
      },
      {
        id: 'sec_third',
        label: 'Third',
        width: 33,
        rows: [createRowDraft('city')],
      },
    ]
    const config = profileFormConfigFromFields(fields, sections)
    const about = config.sections.find((s) => s.id === 'sec_custom')
    assert.ok(about)
    assert.equal(about!.label, 'Custom about')
    assert.equal(about!.width, 100)
    assert.deepEqual(about!.fields.slice(0, 2), ['bio', 'headline'])
    const third = config.sections.find((s) => s.id === 'sec_third')
    assert.equal(third?.width, 33)
  })

  it('defaults missing section width to 100 (same as Forms UI)', () => {
    const fields = fieldsForPreset('profile')
    const sections: FormSectionDef[] = [
      {
        id: 'sec_identity',
        label: 'Identity',
        rows: [createRowDraft('display_name'), createRowDraft('handle')],
      },
    ]
    const config = profileFormConfigFromFields(fields, sections)
    const identity = config.sections.find((s) => s.id === 'sec_identity')
    assert.equal(identity?.width, 100)
  })

  it('applyProfileFormConfigToSettings derives disabled/required from the form', () => {
    const fields: FormFieldDef[] = [
      { name: 'display_name', label: 'Display name', type: 'text', required: true },
      { name: 'handle', label: 'Username', type: 'text', required: true },
      { name: 'avatar', label: 'Avatar', type: 'text', required: true },
      { name: 'bio', label: 'Bio', type: 'textarea', required: true },
    ]
    const config = profileFormConfigFromFields(fields)
    const settings = applyProfileFormConfigToSettings(DEFAULT_PROFILES_MODULE_SETTINGS, config)
    assert.ok(settings.disabledFields.includes('headline'))
    assert.ok(!settings.disabledFields.includes('bio'))
    assert.ok(settings.requiredFields.includes('bio'))
    assert.ok(!settings.requiredFields.includes('displayName'))
  })
})

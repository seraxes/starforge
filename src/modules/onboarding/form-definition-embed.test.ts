import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildOnboardingFormDefinitionEmbedUrl } from './form-definition-embed'

describe('onboarding form definition embed URL', () => {
  it('builds /admin/forms/[formId]?embed=1 for a non-empty form id', () => {
    const built = buildOnboardingFormDefinitionEmbedUrl('form_app')
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.equal(built.formId, 'form_app')
    assert.equal(built.url, '/admin/forms/form_app?embed=1')
  })

  it('encodes the form id in the path', () => {
    const built = buildOnboardingFormDefinitionEmbedUrl('form/with space')
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.equal(
      built.url,
      `/admin/forms/${encodeURIComponent('form/with space')}?embed=1`,
    )
  })

  it('refuses an empty form id and does not build a URL', () => {
    for (const raw of ['', '   ', null, undefined] as const) {
      const refused = buildOnboardingFormDefinitionEmbedUrl(raw)
      assert.equal(refused.ok, false, `expected refuse for ${JSON.stringify(raw)}`)
      if (refused.ok) return
      assert.match(refused.error, /empty/i)
      assert.equal('url' in refused, false)
    }
  })
})

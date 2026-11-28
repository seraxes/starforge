import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildOnboardingEmailTemplateEmbedUrl } from './email-template-embed'

describe('onboarding email template embed URL', () => {
  it('builds /admin/email/templates/[id]?embed=1 for a non-empty template id', () => {
    const built = buildOnboardingEmailTemplateEmbedUrl('tpl-reminder')
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.equal(built.templateId, 'tpl-reminder')
    assert.equal(built.url, '/admin/email/templates/tpl-reminder?embed=1')
  })

  it('encodes the template id in the path', () => {
    const built = buildOnboardingEmailTemplateEmbedUrl('tpl/with space')
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.equal(
      built.url,
      `/admin/email/templates/${encodeURIComponent('tpl/with space')}?embed=1`,
    )
  })

  it('refuses an empty template id and does not build a URL', () => {
    for (const raw of ['', '   ', null, undefined] as const) {
      const refused = buildOnboardingEmailTemplateEmbedUrl(raw)
      assert.equal(refused.ok, false, `expected refuse for ${JSON.stringify(raw)}`)
      if (refused.ok) return
      assert.match(refused.error, /empty/i)
      assert.equal('url' in refused, false)
    }
  })
})

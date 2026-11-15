import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'

import { HeroProfileFields } from './components/HeroProfileFields'

const editorSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'components/ProfileEditor.tsx'),
  'utf8',
)

describe('hero profile editor fields', () => {
  it('shows a fixture field and renders nothing for an empty list', () => {
    const empty = renderToStaticMarkup(
      <HeroProfileFields heroId="fixture" legend="Fixture" fields={[]} values={{}} disabled={false} />,
    )
    assert.equal(empty, '')

    const html = renderToStaticMarkup(
      <HeroProfileFields
        heroId="fixture"
        legend="Fixture"
        fields={[{ key: 'teamName', label: 'Team name', type: 'text', options: [] }]}
        values={{ teamName: 'Red' }}
        disabled={false}
      />,
    )
    assert.match(html, /Team name/)
    assert.match(html, /settings-field/)
    assert.match(html, /value="Red"/)
    assert.match(html, /heroExtensionsJson/)
    assert.match(html, /data-hero="fixture"/)
  })

  it('the profile editor reads ACTIVE_HERO and skips the section when it is empty', () => {
    assert.match(editorSource, /ACTIVE_HERO\.profileFields\.length > 0/)
    assert.match(editorSource, /HeroProfileFields/)
    assert.doesNotMatch(editorSource, /@\/hero/)
  })
})

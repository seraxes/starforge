import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  audienceMatchesSubtype,
  canonicalPlanAudience,
  planSubjectBucket,
  planSubjectLabel,
  planSubtypeLabel,
  planTypeSummary,
} from './catalog'

describe('subscription plan catalog', () => {
  it('treats a blank player audience as Premium', () => {
    assert.equal(canonicalPlanAudience('membership', ''), 'premium')
    assert.equal(planSubtypeLabel('membership', ''), 'Premium')
    assert.equal(audienceMatchesSubtype('membership', '', 'premium'), true)
    assert.equal(audienceMatchesSubtype('membership', '', 'premium_plus'), false)
  })

  it('treats a blank organizer audience as Organizer', () => {
    assert.equal(canonicalPlanAudience('organizer', ''), 'organizer')
    assert.equal(audienceMatchesSubtype('organizer', 'brand', 'brand'), true)
    assert.equal(planTypeSummary('organizer', 'brand'), 'Organizers · Brand page')
  })

  it('keeps advertisement audiences explicit', () => {
    assert.equal(canonicalPlanAudience('advertisement', ''), '')
    assert.equal(audienceMatchesSubtype('advertisement', '', 'shop'), false)
    assert.equal(audienceMatchesSubtype('advertisement', 'shop', 'shop'), true)
    assert.equal(planSubtypeLabel('advertisement', 'marketplace'), 'Marketplace')
    assert.equal(audienceMatchesSubtype('advertisement', 'shop', ''), true)
  })

  it('buckets unknown subjects under Other without hiding the raw label', () => {
    assert.equal(planSubjectBucket('highlight'), 'other')
    assert.equal(planSubjectBucket('other'), 'other')
    assert.equal(planSubjectLabel('highlight'), 'highlight')
    assert.equal(planSubjectLabel('other'), 'Other')
    assert.equal(planSubjectBucket('membership'), 'membership')
  })
})

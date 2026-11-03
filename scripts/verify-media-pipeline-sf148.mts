/**
 * SF-148 smoke: MediaPipelineRules + analysis stub + S3 throw-on-incomplete wiring.
 * Run: npm run verify:media-pipeline
 */
import assert from 'node:assert/strict'
import sharp from 'sharp'

import { applyMediaPipelineRules } from '../src/core/media/apply-pipeline.ts'
import { getMediaAnalysisPort } from '../src/core/media/analysis/index.ts'
import { DEFAULT_MEDIA_PIPELINE_RULES } from '../src/core/media/pipeline.ts'
import { isS3MediaStorageSelected, readS3MediaEnv } from '../src/core/media/storage/env.ts'

async function main() {
  assert.equal(DEFAULT_MEDIA_PIPELINE_RULES.photoOriginalFormat, 'webp')
  assert.equal(DEFAULT_MEDIA_PIPELINE_RULES.keepPngForLogos, true)

  const jpeg = await sharp({
    create: { width: 16, height: 16, channels: 3, background: '#88aacc' },
  })
    .jpeg()
    .toBuffer()

  const photo = await applyMediaPipelineRules({
    buffer: jpeg,
    mimeType: 'image/jpeg',
    purpose: 'photo',
  })
  assert.equal(photo.mimetype, 'image/webp')

  const port = getMediaAnalysisPort()
  assert.ok(port.list().some((a) => a.id === 'noop'))
  const emptyRun = await port.run({
    mediaId: '0',
    mime: 'image/webp',
    source: { buffer: photo.data },
  })
  assert.equal(emptyRun.length, 0, 'empty hooks must not auto-run analyzers')

  const explicit = await port.run({
    mediaId: '0',
    mime: 'image/webp',
    source: { buffer: photo.data },
    hooks: ['noop'],
  })
  assert.equal(explicit.length, 1)
  assert.equal(explicit[0]?.ok, true)

  // S3 selection without credentials must report missing keys (no silent local).
  const prev = process.env.STARFORGE_MEDIA_STORAGE
  process.env.STARFORGE_MEDIA_STORAGE = 's3'
  assert.equal(isS3MediaStorageSelected(), true)
  const { missing } = readS3MediaEnv()
  assert.ok(missing.length >= 1, 'incomplete S3 env must list missing keys')
  if (prev === undefined) delete process.env.STARFORGE_MEDIA_STORAGE
  else process.env.STARFORGE_MEDIA_STORAGE = prev

  console.log('verify:media-pipeline OK')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

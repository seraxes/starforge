import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

import { applyMediaPipelineRules } from './apply-pipeline'
import {
  DEFAULT_MEDIA_PIPELINE_RULES,
  clampMediaEncodeFlags,
  normalizeMediaPipelineRules,
  resolveMediaEncodePolicy,
} from './pipeline'

const here = path.dirname(fileURLToPath(import.meta.url))

async function tinyJpeg(width = 40, height = 30): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 120, b: 80 },
    },
  })
    .jpeg()
    .toBuffer()
}

async function tinyPng(width = 32, height = 32): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer()
}

describe('applyMediaPipelineRules', () => {
  it('converts photo JPEG to WebP', async () => {
    const input = await tinyJpeg()
    const out = await applyMediaPipelineRules({
      buffer: input,
      mimeType: 'image/jpeg',
      purpose: 'photo',
    })
    assert.equal(out.mimetype, 'image/webp')
    assert.equal(out.extHint, 'webp')
    const meta = await sharp(out.data).metadata()
    assert.equal(meta.format, 'webp')
  })

  it('converts photo PNG to WebP', async () => {
    const input = await tinyPng()
    const out = await applyMediaPipelineRules({
      buffer: input,
      mimeType: 'image/png',
      purpose: 'photo',
      rules: DEFAULT_MEDIA_PIPELINE_RULES,
    })
    assert.equal(out.mimetype, 'image/webp')
    assert.equal(out.extHint, 'webp')
    const meta = await sharp(out.data).metadata()
    assert.equal(meta.format, 'webp')
  })

  it('keeps logo PNG when keepPngForLogos is on', async () => {
    const input = await tinyPng()
    const out = await applyMediaPipelineRules({
      buffer: input,
      mimeType: 'image/png',
      purpose: 'logo',
    })
    assert.equal(out.mimetype, 'image/png')
    const meta = await sharp(out.data).metadata()
    assert.equal(meta.format, 'png')
  })

  it('keeps logo JPEG as JPEG', async () => {
    const input = await tinyJpeg()
    const out = await applyMediaPipelineRules({
      buffer: input,
      mimeType: 'image/jpeg',
      purpose: 'logo',
      rules: DEFAULT_MEDIA_PIPELINE_RULES,
    })
    assert.equal(out.mimetype, 'image/jpeg')
    assert.equal(out.extHint, 'jpg')
  })

  it('keeps JPEG when decodeToWebp is false', async () => {
    const input = await tinyJpeg()
    const out = await applyMediaPipelineRules({
      buffer: input,
      mimeType: 'image/jpeg',
      purpose: 'photo',
      decodeToWebp: false,
    })
    assert.equal(out.mimetype, 'image/jpeg')
    assert.equal(out.extHint, 'jpg')
    const meta = await sharp(out.data).metadata()
    assert.equal(meta.format, 'jpeg')
  })

  it('skips resize when resize is false', async () => {
    const input = await tinyJpeg(800, 600)
    const out = await applyMediaPipelineRules({
      buffer: input,
      mimeType: 'image/jpeg',
      purpose: 'photo',
      resize: false,
      rules: normalizeMediaPipelineRules({
        ...DEFAULT_MEDIA_PIPELINE_RULES,
        maxWidth: 400,
        maxHeight: 400,
      }),
    })
    assert.equal(out.mimetype, 'image/webp')
    const meta = await sharp(out.data).metadata()
    assert.equal(meta.width, 800)
    assert.equal(meta.height, 600)
  })

  it('passes non-images through', async () => {
    const pdf = Buffer.from('%PDF-1.4 tiny')
    const out = await applyMediaPipelineRules({
      buffer: pdf,
      mimeType: 'application/pdf',
      purpose: 'other',
    })
    assert.equal(out.mimetype, 'application/pdf')
    assert.equal(out.data.equals(pdf), true)
  })

  it('converts photo GIF to WebP', async () => {
    const gif = await sharp({
      create: {
        width: 12,
        height: 12,
        channels: 3,
        background: { r: 10, g: 120, b: 200 },
      },
    })
      .gif()
      .toBuffer()
    const out = await applyMediaPipelineRules({
      buffer: gif,
      mimeType: 'image/gif',
      purpose: 'photo',
    })
    assert.equal(out.mimetype, 'image/webp')
    assert.equal(out.extHint, 'webp')
  })

  it('keeps logo WebP as WebP', async () => {
    const webp = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: { r: 40, g: 40, b: 40 },
      },
    })
      .webp()
      .toBuffer()
    const out = await applyMediaPipelineRules({
      buffer: webp,
      mimeType: 'image/webp',
      purpose: 'logo',
    })
    assert.equal(out.mimetype, 'image/webp')
    assert.equal(out.extHint, 'webp')
  })

  it('caps oversized edges without enlargement of small images', async () => {
    const input = await tinyJpeg(20, 10)
    const out = await applyMediaPipelineRules({
      buffer: input,
      mimeType: 'image/jpeg',
      purpose: 'photo',
    })
    const meta = await sharp(out.data).metadata()
    assert.ok((meta.width ?? 0) <= 20)
    assert.ok((meta.height ?? 0) <= 10)
  })

  it('honors custom rules max edge + webp quality path', async () => {
    const input = await tinyJpeg(800, 600)
    const out = await applyMediaPipelineRules({
      buffer: input,
      mimeType: 'image/jpeg',
      purpose: 'photo',
      rules: normalizeMediaPipelineRules({
        ...DEFAULT_MEDIA_PIPELINE_RULES,
        maxWidth: 400,
        maxHeight: 400,
        webpQuality: 50,
      }),
    })
    assert.equal(out.mimetype, 'image/webp')
    const meta = await sharp(out.data).metadata()
    assert.ok((meta.width ?? 0) <= 400)
    assert.ok((meta.height ?? 0) <= 400)
  })
})

describe('normalizeMediaPipelineRules', () => {
  it('clamps quality and edges; keeps PNG flag off when false', () => {
    const rules = normalizeMediaPipelineRules({
      maxWidth: 50,
      maxHeight: 99999,
      jpegQuality: 0,
      webpQuality: 200,
      keepPngForLogos: false,
      decodeByGroup: { editors: 'choose', junk: 'maybe' },
      resizeByGroup: { editors: 'force' },
    })
    assert.equal(rules.maxWidth, 320)
    assert.equal(rules.maxHeight, 8192)
    assert.equal(rules.jpegQuality, 1)
    assert.equal(rules.webpQuality, 100)
    assert.equal(rules.keepPngForLogos, false)
    assert.equal(rules.photoOriginalFormat, 'webp')
    assert.deepEqual(rules.decodeByGroup, { editors: 'choose' })
    assert.deepEqual(rules.resizeByGroup, { editors: 'force' })
  })
})

describe('resolveMediaEncodePolicy + clampMediaEncodeFlags', () => {
  const rules = normalizeMediaPipelineRules({
    decodeByGroup: { editors: 'choose' },
    resizeByGroup: { editors: 'choose', managers: 'force' },
  })

  it('app admin always can choose', () => {
    const policy = resolveMediaEncodePolicy(
      { isAppAdmin: true, groupIds: [] },
      rules,
    )
    assert.deepEqual(policy, { canChooseDecode: true, canChooseResize: true })
  })

  it('union of group choose wins', () => {
    const policy = resolveMediaEncodePolicy(
      { isAppAdmin: false, groupIds: ['editors', 'managers'] },
      rules,
    )
    assert.equal(policy.canChooseDecode, true)
    assert.equal(policy.canChooseResize, true)
  })

  it('missing group stays forced', () => {
    const policy = resolveMediaEncodePolicy(
      { isAppAdmin: false, groupIds: ['members'] },
      rules,
    )
    assert.deepEqual(policy, { canChooseDecode: false, canChooseResize: false })
  })

  it('forced viewers ignore posted off flags', () => {
    const flags = clampMediaEncodeFlags(
      { canChooseDecode: false, canChooseResize: false },
      { decodeToWebp: false, resize: false },
    )
    assert.deepEqual(flags, { decodeToWebp: true, resize: true })
  })

  it('choosers keep posted off flags', () => {
    const flags = clampMediaEncodeFlags(
      { canChooseDecode: true, canChooseResize: true },
      { decodeToWebp: false, resize: false },
    )
    assert.deepEqual(flags, { decodeToWebp: false, resize: false })
  })
})

// Touch repo root so the test file is discoverable without side effects.
void readFileSync(path.join(here, 'pipeline.ts'), 'utf8')

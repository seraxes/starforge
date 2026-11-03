/**
 * MediaAnalysisPort — OCR / vision / quality hooks (SF-148 stub).
 * Analyzers plug in without forking Media; results suggest Media field patches.
 * No vendor SDKs here — adapters register later (console, HTTP webhook, …).
 */

export type MediaAnalysisResult = {
  ok: boolean
  /** Machine-readable kind for adapters (ocr, quality, vision, moderation, …). */
  kind: string
  /** Optional human summary for admin UI. */
  summary?: string
  /** Structured payload (OCR text, scores, labels, bounding boxes, …). */
  data?: Record<string, unknown>
  /** Suggested Media field patches — editor confirms; never silent overwrite. */
  suggestions?: {
    alt?: string
    tagIds?: string[]
    categoryIds?: string[]
    purpose?: 'logo' | 'photo' | 'other'
  }
}

export type MediaAnalyzerInput = {
  mediaId: string
  mime: string
  /** Local path, buffer, or signed URL — adapter chooses; Core resolves from storage. */
  source: { buffer?: Buffer; url?: string; path?: string }
  purpose?: 'logo' | 'photo' | 'other'
  /** Which analyzers to run (allowlist); empty = Site Settings default set. */
  hooks?: string[]
}

export type MediaAnalyzer = {
  id: string
  /** e.g. ocr | quality | vision | moderation */
  kind: string
  analyze(input: MediaAnalyzerInput): Promise<MediaAnalysisResult>
}

export type MediaAnalysisPort = {
  /** Registered adapters (console stub, HTTP webhook, vendor SDK, …). */
  list(): MediaAnalyzer[]
  run(input: MediaAnalyzerInput): Promise<MediaAnalysisResult[]>
}

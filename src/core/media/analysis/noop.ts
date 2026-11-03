import type { MediaAnalysisPort, MediaAnalyzer, MediaAnalyzerInput, MediaAnalysisResult } from './types'

/**
 * Dev / default adapter — proves the port wiring without vendor lock-in.
 * Does not call external APIs; returns an empty ok result when explicitly run.
 */
const noopAnalyzer: MediaAnalyzer = {
  id: 'noop',
  kind: 'noop',
  async analyze(input: MediaAnalyzerInput): Promise<MediaAnalysisResult> {
    return {
      ok: true,
      kind: 'noop',
      summary: `No-op analysis for media ${input.mediaId} (${input.mime}).`,
      data: { mediaId: input.mediaId, hooks: input.hooks ?? [] },
    }
  },
}

export function createNoopMediaAnalysisPort(): MediaAnalysisPort {
  const analyzers: MediaAnalyzer[] = [noopAnalyzer]
  return {
    list() {
      return analyzers
    },
    async run(input) {
      const wanted = new Set((input.hooks ?? []).map((h) => h.trim()).filter(Boolean))
      const selected = wanted.size
        ? analyzers.filter((a) => wanted.has(a.id) || wanted.has(a.kind))
        : []
      // Empty hooks = no auto-run (Site Settings default set later).
      return Promise.all(selected.map((a) => a.analyze(input)))
    },
  }
}

/**
 * MediaAnalysisPort factory (SF-148).
 * Swap adapters via env later; today = noop only.
 */

import { createNoopMediaAnalysisPort } from './noop'
import type { MediaAnalysisPort } from './types'

export type {
  MediaAnalysisPort,
  MediaAnalysisResult,
  MediaAnalyzer,
  MediaAnalyzerInput,
} from './types'

export { createNoopMediaAnalysisPort } from './noop'

let cached: MediaAnalysisPort | null = null

/** Process-wide port — thin stub until Site Settings registers real analyzers. */
export function getMediaAnalysisPort(): MediaAnalysisPort {
  if (!cached) cached = createNoopMediaAnalysisPort()
  return cached
}

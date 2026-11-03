# product:media

Required Media library pack (SF-148). Catalog/manifest only for now — sharp pipeline, storage port, Core admin UI, and `MediaAnalysisPort` still live in `src/core/media` until design M5 moves the library surface here.

- Public API consumers: `@/core/media` (`resolveMediaById`, `MediaPicker`, tags filter).
- Storage: Core `MediaStorage` (local → Spaces/S3 via env / Chrome → Environment).
- Analysis: Core `MediaAnalysisPort` stub (noop) — listed on Media admin; OCR/AI adapters later.

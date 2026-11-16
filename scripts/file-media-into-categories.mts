/**
 * File existing media blobs under their category slug prefix.
 * Local disk and S3 use the same relative key. Safe to run again.
 *
 * Dry run (no writes):
 *   npm run file:media-categories
 * Apply:
 *   npm run file:media-categories -- --apply
 */
import 'dotenv/config'

import { listAssetPlacements, listCategoryRows } from '../src/core/media/document-store.ts'
import {
  placeRow,
  planAssetPlacement,
  storagePrefixForCategoryId,
} from '../src/core/media/place-asset.ts'
import { getMediaStorage, getMediaStorageInfo } from '../src/core/media/storage/index.ts'

const BATCH = 25

function cell(value: string): string {
  return value.replace(/\s+/g, ' ').trim() || '—'
}

async function main() {
  const apply = process.argv.includes('--apply')
  const info = getMediaStorageInfo()
  if (!info.ready) {
    console.error(info.detail || 'Media storage is not ready.')
    process.exit(1)
  }
  console.log(`storage: ${info.kind} (${info.label})`)
  console.log(apply ? 'mode: apply' : 'mode: dry-run')

  const categories = await listCategoryRows()
  const byId = new Map(categories.map((cat) => [cat.id, cat]))
  const rows = await listAssetPlacements()
  const storage = getMediaStorage()

  if (!apply) {
    let move = 0
    let skip = 0
    let missing = 0
    console.log('id\talt\tcurrent\ttarget\tsource\taction')
    for (const row of rows) {
      const prefix = storagePrefixForCategoryId(row.categoryId, byId)
      const plan = planAssetPlacement(row, prefix)
      const present = plan.currentKey ? await storage.exists(plan.currentKey) : false
      const action = !plan.needsMove ? 'skip' : present ? 'move' : 'missing'
      if (action === 'move') move += 1
      else if (action === 'skip') skip += 1
      else missing += 1
      console.log(
        [
          row.id,
          cell(row.alt),
          plan.currentKey || '(none)',
          plan.targetKey || '(none)',
          present ? 'present' : 'missing',
          action,
        ].join('\t'),
      )
    }
    console.log(`assets: ${rows.length}  move: ${move}  skip: ${skip}  missing: ${missing}`)
    return
  }

  let moved = 0
  let skipped = 0
  let missing = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    for (const row of batch) {
      const prefix = storagePrefixForCategoryId(row.categoryId, byId)
      const plan = planAssetPlacement(row, prefix)
      const status = await placeRow(row, prefix)
      if (status === 'moved') moved += 1
      else if (status === 'skipped') skipped += 1
      else missing += 1
      console.log(
        [
          status,
          row.id,
          cell(row.alt),
          plan.currentKey || '(none)',
          '->',
          plan.targetKey || '(none)',
        ].join('\t'),
      )
    }
  }
  console.log(`assets: ${rows.length}  moved: ${moved}  skipped: ${skipped}  missing: ${missing}`)
}

main().catch((err) => {
  console.error('file-media-into-categories failed', err)
  process.exit(1)
})

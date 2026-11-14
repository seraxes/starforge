/**
 * One-shot: dedupe sf_nav_menus.document items by id (keeps first).
 * Document may be jsonb object or a JSON string inside jsonb.
 * Usage: npx tsx scripts/dedupe-nav-menu-items.mts
 */
import pg from 'pg'

const url =
  process.env.DATABASE_URL ||
  'postgresql://starforge:starforge@127.0.0.1:15432/starforge'

type NavItem = { id?: string; label?: string; [key: string]: unknown }
type NavDoc = { version?: number; items?: NavItem[] }

function parseDocument(raw: unknown): NavDoc {
  if (raw == null) return { version: 1, items: [] }
  if (typeof raw === 'string') {
    try {
      return parseDocument(JSON.parse(raw) as unknown)
    } catch {
      return { version: 1, items: [] }
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const doc = raw as NavDoc
    return {
      version: typeof doc.version === 'number' ? doc.version : 1,
      items: Array.isArray(doc.items) ? doc.items : [],
    }
  }
  return { version: 1, items: [] }
}

const client = new pg.Client({ connectionString: url })
await client.connect()

const { rows } = await client.query<{ id: string; label: string; document: unknown }>(
  'SELECT id, label, document FROM sf_nav_menus',
)

for (const row of rows) {
  const doc = parseDocument(row.document)
  const items = doc.items ?? []
  const seen = new Set<string>()
  const next: NavItem[] = []
  let dropped = 0
  for (const item of items) {
    const id = typeof item?.id === 'string' ? item.id : ''
    if (!id) {
      next.push(item)
      continue
    }
    if (seen.has(id)) {
      dropped += 1
      continue
    }
    seen.add(id)
    next.push(item)
  }

  const labelCounts: Record<string, number> = {}
  for (const item of items) {
    const label = String(item?.label ?? '?')
    labelCounts[label] = (labelCounts[label] || 0) + 1
  }

  console.log(
    `${row.id} (${row.label}): ${items.length} → ${next.length} (dropped ${dropped})`,
    'labels',
    labelCounts,
  )

  if (dropped === 0 && items.length === next.length) continue

  // Store as jsonb object (not a nested JSON string).
  await client.query(
    `UPDATE sf_nav_menus
     SET document = $1::jsonb, updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify({ version: 1, items: next }), row.id],
  )
}

await client.end()
console.log('done')

import pg from 'pg'

const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://starforge:starforge@127.0.0.1:15432/starforge',
})
await client.connect()
const { rows } = await client.query('SELECT id, label, document FROM sf_nav_menus')
for (const row of rows) {
  const doc = row.document
  console.log('---', row.id, row.label)
  console.log('typeof', typeof doc)
  console.log('keys', doc && typeof doc === 'object' ? Object.keys(doc) : null)
  const items = doc?.items
  console.log('items length', Array.isArray(items) ? items.length : items)
  if (Array.isArray(items) && items.length > 0) {
    console.log(
      'first 5',
      items.slice(0, 5).map((i: { id?: string; label?: string; linkType?: string }) => ({
        id: i.id,
        label: i.label,
        linkType: i.linkType,
      })),
    )
    const counts: Record<string, number> = {}
    for (const i of items) {
      const id = String(i?.id ?? '?')
      counts[id] = (counts[id] || 0) + 1
    }
    const dups = Object.entries(counts).filter(([, n]) => n > 1)
    console.log('dup ids', dups.slice(0, 10), 'total dup kinds', dups.length)
  } else {
    console.log(JSON.stringify(doc)?.slice(0, 500))
  }
}
await client.end()

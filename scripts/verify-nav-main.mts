import pg from 'pg'

const c = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://starforge:starforge@127.0.0.1:15432/starforge',
})
await c.connect()
const r = await c.query(`SELECT id, document FROM sf_nav_menus WHERE id = 'main'`)
const raw = r.rows[0]?.document
const d = typeof raw === 'string' ? JSON.parse(raw) : raw
console.log('count', d.items.length)
console.log(
  d.items.map((i: { id: string; label: string; linkType: string }) => ({
    id: i.id,
    label: i.label,
    linkType: i.linkType,
  })),
)
await c.end()

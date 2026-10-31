/** Parse a loose `data-foo="bar" role="main"` attribute string into a props bag. */
export function parseBodyTagAttributes(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw.trim()) return out
  const re = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
  let match: RegExpExecArray | null
  while ((match = re.exec(raw)) !== null) {
    const name = match[1]
    if (!name || name === 'id' || name === 'class' || name === 'className') continue
    // Avoid hijacking React reserved / event handlers from admin HTML.
    if (/^on/i.test(name) || name.includes('>')) continue
    out[name] = match[2] ?? match[3] ?? match[4] ?? ''
  }
  return out
}

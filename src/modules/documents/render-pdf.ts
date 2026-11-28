/**
 * Pack-local merge PDF for product:documents.
 * Caller passes values; this pack does not read Onboarding, Fleet, or Forms tables.
 */

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function line(y: number, label: string, value: string): string {
  const text = `${label}: ${value || '—'}`
  return `BT /F1 10 Tf 50 ${y} Td (${escapePdfText(text)}) Tj ET`
}

/**
 * Render merge values as PDF 1.4 bytes (no external PDF dependency).
 */
export function renderDocumentValuesPdf(
  title: string,
  values: Record<string, string>,
): Buffer {
  const lines: string[] = []
  let y = 800
  const heading = (title || 'Document').trim() || 'Document'
  lines.push(`BT /F1 14 Tf 50 ${y} Td (${escapePdfText(heading)}) Tj ET`)
  y -= 28

  for (const [key, raw] of Object.entries(values)) {
    if (y < 60) break
    const label = (key ?? '').trim() || 'field'
    const value = typeof raw === 'string' ? raw : String(raw ?? '')
    lines.push(line(y, label, value))
    y -= 16
  }

  if (Object.keys(values).length === 0) {
    lines.push(line(y, '(empty)', ''))
  }

  const content = lines.join('\n')
  const contentLength = Buffer.byteLength(content, 'utf8')

  const objects: string[] = []
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
  )
  objects.push(`4 0 obj\n<< /Length ${contentLength} >>\nstream\n${content}\nendstream\nendobj\n`)
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')

  let body = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body, 'utf8'))
    body += obj
  }
  const xrefStart = Buffer.byteLength(body, 'utf8')
  body += `xref\n0 ${objects.length + 1}\n`
  body += '0000000000 65535 f \n'
  for (let i = 1; i <= objects.length; i++) {
    body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  body += `startxref\n${xrefStart}\n%%EOF\n`
  return Buffer.from(body, 'utf8')
}

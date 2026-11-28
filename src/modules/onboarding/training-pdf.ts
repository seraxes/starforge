/**
 * Pack-local training-report PDF while product:documents is off.
 * Produces PDF 1.4 bytes; callers store them via Media (`mediaId`).
 * When Documents is on, training-store calls renderDocumentTemplate instead.
 */

import type { TrainingChecklistSection } from './training-rules'
import type { OnboardingTrainingReportRecord } from './types'

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function line(y: number, label: string, value: string): string {
  const text = `${label}: ${value || '—'}`
  return `BT /F1 10 Tf 50 ${y} Td (${escapePdfText(text)}) Tj ET`
}

/**
 * Render a training report as PDF bytes (no external PDF dependency).
 */
export function renderTrainingReportPdf(
  report: OnboardingTrainingReportRecord,
  checklist: TrainingChecklistSection[],
): Buffer {
  const lines: string[] = []
  let y = 800
  const push = (label: string, value: string) => {
    lines.push(line(y, label, value))
    y -= 16
  }

  lines.push(`BT /F1 14 Tf 50 ${y} Td (${escapePdfText('Training report')}) Tj ET`)
  y -= 28
  push('Report id', report.id)
  push('Trainee', report.traineeUserId)
  push('Instructor', report.instructorUserId)
  push('Date', report.reportDate)
  push('Depot', [report.depotKey, report.depotLabel].filter(Boolean).join(' — '))
  push('Training day', report.trainingDay)
  push('Plate', report.plate)
  push('Rounds', String(report.rounds))
  push('Drove', report.drove ? 'yes' : 'no')
  push('Status', report.status)
  push('Passed', report.passed || '(empty)')
  push('Note', report.note)
  y -= 8
  lines.push(`BT /F1 12 Tf 50 ${y} Td (${escapePdfText('Checklist (14 sections)')}) Tj ET`)
  y -= 18
  for (const section of checklist) {
    if (y < 60) break
    const level = section.level || '—'
    const note = section.note ? ` — ${section.note}` : ''
    lines.push(line(y, section.label || section.key, `${level}${note}`))
    y -= 14
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
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  return Buffer.from(body, 'utf8')
}

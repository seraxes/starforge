/**
 * Filter Form fields by accessTags (same OR-match as Layout / Nav).
 * Client-safe helpers; pair with getAccessViewer on the server.
 */

import { canSeeNavAccessTags, resolveAccessTags } from '@/core/acl/nav-access'
import type { AccessViewer } from '@/core/acl/types'

import type { FormFieldDef, FormSectionDef } from './types'

/** True when the viewer may see this field (empty / public tags → always). */
export function canSeeFormField(
  field: FormFieldDef,
  viewer: AccessViewer,
): boolean {
  const tags = resolveAccessTags({ accessTags: field.accessTags })
  if (tags.length === 1 && tags[0] === 'public') return true
  return canSeeNavAccessTags(tags, viewer)
}

export function filterFormFieldsForViewer(
  fields: FormFieldDef[],
  viewer: AccessViewer,
): FormFieldDef[] {
  return fields.filter((field) => canSeeFormField(field, viewer))
}

/** Drop section rows/columns whose fields were filtered out. */
export function filterFormSectionsForFields(
  sections: FormSectionDef[] | undefined,
  fields: FormFieldDef[],
): FormSectionDef[] | undefined {
  if (!sections?.length) return sections
  const names = new Set(fields.map((f) => f.name))
  return sections
    .map((section) => ({
      ...section,
      rows: section.rows
        .map((row) => ({
          ...row,
          columns: row.columns.filter((col) => names.has(col.fieldName)),
        }))
        .filter((row) => row.columns.length > 0),
    }))
    .filter((section) => section.rows.length > 0)
}

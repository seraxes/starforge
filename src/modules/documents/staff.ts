/**
 * product:documents — staff edit gate (pure).
 *
 * Passes when the viewer is an app admin, or when they already hold
 * admin.documents edit (from viewerMayAccessAdminResource). App admin
 * bypasses. See sf-staff-bypass + documents-build-spec slice 4.
 */

export type DocumentsStaffEditInput = {
  isAppAdmin: boolean
  /** True when viewerMayAccessAdminResource(viewer, 'admin.documents', 'edit') would pass. */
  hasDocumentsEditGrant: boolean
}

/**
 * Staff may open / edit Documents admin when they are an app admin or hold
 * admin.documents edit. Neither → refuse.
 */
export function decideDocumentsStaffEdit(input: DocumentsStaffEditInput): boolean {
  return Boolean(input.isAppAdmin || input.hasDocumentsEditGrant)
}

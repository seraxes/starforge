import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isAdminLibraryUploadAllowed,
  mediaAdminFileHref,
  mediaLibraryPreviewKind,
  resolveAdminLibraryMime,
} from './library-files'

describe('admin library file kinds', () => {
  it('keeps images allowed and blocks SVG', () => {
    assert.equal(isAdminLibraryUploadAllowed('image/png', 'a.png'), true)
    assert.equal(isAdminLibraryUploadAllowed('image/jpeg', 'a.jpg'), true)
    assert.equal(isAdminLibraryUploadAllowed('image/svg+xml', 'a.svg'), false)
    assert.equal(isAdminLibraryUploadAllowed('image/png', 'a.svg'), false)
    assert.equal(isAdminLibraryUploadAllowed('', 'photo.webp'), true)
  })

  it('allows Forms document types only when the library opts in', () => {
    assert.equal(isAdminLibraryUploadAllowed('application/pdf', 'a.pdf'), false)
    assert.equal(
      isAdminLibraryUploadAllowed('application/pdf', 'a.pdf', { documents: true }),
      true,
    )
    assert.equal(
      isAdminLibraryUploadAllowed(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'a.docx',
        { documents: true },
      ),
      true,
    )
    assert.equal(
      isAdminLibraryUploadAllowed('', 'notes.txt', { documents: true }),
      true,
    )
    assert.equal(
      isAdminLibraryUploadAllowed('application/x-msdownload', 'a.exe', { documents: true }),
      false,
    )
  })

  it('fills an empty browser MIME from the extension', () => {
    assert.equal(resolveAdminLibraryMime('', 'scan.pdf'), 'application/pdf')
    assert.equal(resolveAdminLibraryMime('image/png', 'a.png'), 'image/png')
  })

  it('classifies previews and routes private files through the admin attachment URL', () => {
    assert.equal(mediaLibraryPreviewKind('application/pdf', 'a.pdf'), 'pdf')
    assert.equal(mediaLibraryPreviewKind('text/plain', 'a.txt'), 'text')
    assert.equal(mediaLibraryPreviewKind('image/png', 'a.png'), 'image')
    assert.equal(mediaLibraryPreviewKind('image/svg+xml', 'a.svg'), 'file')
    assert.equal(mediaAdminFileHref({ id: '9', private: false, folder: 'general' }), null)
    assert.equal(
      mediaAdminFileHref({ id: '9', private: true, folder: 'general' }, { inline: true }),
      '/api/admin/form-attachments/9?inline=1',
    )
    assert.equal(
      mediaAdminFileHref({ id: '4', folder: 'forms' }),
      '/api/admin/form-attachments/4',
    )
  })
})

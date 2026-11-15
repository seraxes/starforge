/** Chrome strings for the Media library (phase 2a). Loaded from the module message pack. */

export type MediaLibraryChrome = {
  libraryLede: string
  settingsLink: string
  storeNote: string
  editHeading: string
  fieldAlt: string
  fieldPurpose: string
  fieldCategory: string
  fieldTags: string
  fieldPrivate: string
  privateHint: string
  uncategorized: string
  noTagsYet: string
  saveDetails: string
  savingDetails: string
  replaceHeading: string
  replaceHint: string
  replaceFile: string
  replacingFile: string
  replaceNeedsFile: string
  fileTypeRejected: string
  noPreview: string
  openFile: string
  privateBadge: string
  pagePrev: string
  pageNext: string
  pageStatus: string
  showingRange: string
  tagsHeading: string
  tagTitle: string
  tagCreate: string
  tagRename: string
  tagSave: string
  tagCancel: string
  tagEmpty: string
  tagFilterEmpty: string
  uploadNeedsFile: string
  uploadNeedsLabel: string
  uploadIntro: string
  dropTitle: string
  dropHint: string
  chooseFile: string
  changeFile: string
  emptyUpload: string
  filePdf: string
  fileDoc: string
  fileText: string
  fileOther: string
}

type Translate = (key: string, values?: Record<string, string | number>) => string

/** Keep `{name}` placeholders so the client can fill page numbers. */
export function buildMediaLibraryChrome(
  t: Translate,
  vars: { maxEdge: number },
): MediaLibraryChrome {
  return {
    libraryLede: t('libraryLede'),
    settingsLink: t('settingsLink'),
    storeNote: t('storeNote'),
    editHeading: t('editHeading'),
    fieldAlt: t('fieldAlt'),
    fieldPurpose: t('fieldPurpose'),
    fieldCategory: t('fieldCategory'),
    fieldTags: t('fieldTags'),
    fieldPrivate: t('fieldPrivate'),
    privateHint: t('privateHint'),
    uncategorized: t('uncategorized'),
    noTagsYet: t('noTagsYet'),
    saveDetails: t('saveDetails'),
    savingDetails: t('savingDetails'),
    replaceHeading: t('replaceHeading'),
    replaceHint: t('replaceHint'),
    replaceFile: t('replaceFile'),
    replacingFile: t('replacingFile'),
    replaceNeedsFile: t('replaceNeedsFile'),
    fileTypeRejected: t('fileTypeRejected'),
    noPreview: t('noPreview'),
    openFile: t('openFile'),
    privateBadge: t('privateBadge'),
    pagePrev: t('pagePrev'),
    pageNext: t('pageNext'),
    pageStatus: t('pageStatus', { page: '{page}', pages: '{pages}' }),
    showingRange: t('showingRange', { from: '{from}', to: '{to}', total: '{total}' }),
    tagsHeading: t('tagsHeading'),
    tagTitle: t('tagTitle'),
    tagCreate: t('tagCreate'),
    tagRename: t('tagRename'),
    tagSave: t('tagSave'),
    tagCancel: t('tagCancel'),
    tagEmpty: t('tagEmpty'),
    tagFilterEmpty: t('tagFilterEmpty'),
    uploadNeedsFile: t('uploadNeedsFile'),
    uploadNeedsLabel: t('uploadNeedsLabel'),
    uploadIntro: t('uploadIntro', { maxEdge: vars.maxEdge }),
    dropTitle: t('dropTitle'),
    dropHint: t('dropHint'),
    chooseFile: t('chooseFile'),
    changeFile: t('changeFile'),
    emptyUpload: t('emptyUpload'),
    filePdf: t('filePdf'),
    fileDoc: t('fileDoc'),
    fileText: t('fileText'),
    fileOther: t('fileOther'),
  }
}

export function fillMediaChrome(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : '',
  )
}

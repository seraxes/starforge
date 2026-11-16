import React from 'react'

import { PagesEditorScreen } from './pages-editor-screen'

export const metadata = {
  title: 'New page — Starforge',
  description: 'Create a brochure page.',
}

export default function PagesNewPage() {
  return <PagesEditorScreen pageId={null} />
}

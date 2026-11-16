import React from 'react'
import { notFound } from 'next/navigation'

import { PagesEditorScreen } from './pages-editor-screen'

export const metadata = {
  title: 'Edit page — Starforge',
  description: 'Edit a brochure page.',
}

type Params = Promise<{ pageId: string }>

export default async function PagesEditPage({ params }: { params: Params }) {
  const { pageId } = await params
  const id = (pageId || '').trim()
  if (!id || id === 'new') notFound()
  return <PagesEditorScreen pageId={id} />
}

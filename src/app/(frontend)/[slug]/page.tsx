import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { RichText } from '@/components/RichText'
import { buildPageMetadata } from '@/core/content/metadata'
import { getPublishedPageBySlug } from '@/core/content/pages'

type Args = {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const page = await getPublishedPageBySlug(decodeURIComponent(slug))

  if (!page) {
    return {
      title: 'Not found — Starforge',
    }
  }

  return buildPageMetadata(page)
}

export default async function PublicCmsPage({ params }: Args) {
  const { slug } = await params
  const decodedSlug = decodeURIComponent(slug)
  const page = await getPublishedPageBySlug(decodedSlug)

  if (!page) {
    notFound()
  }

  return (
    <article className="cms-page">
      <header className="cms-page-header">
        <p className="brand">
          <Link href="/">Starforge</Link>
        </p>
        <h1>{page.title}</h1>
      </header>
      {page.body ? <RichText data={page.body} /> : <p className="lede">This page has no body yet.</p>}
    </article>
  )
}

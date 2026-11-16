import React from 'react'

export function formatPageDate(iso: string, locale: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
}

type BylinePage = {
  createdAt: string
  publishedAt?: string | null
  creatorName?: string | null
  publisherName?: string | null
}

type BylineT = (key: string, values?: Record<string, string>) => string

/** Created and published lines for a public page. */
export function PageByline({
  locale,
  page,
  t,
}: {
  locale: string
  page: BylinePage
  t: BylineT
}) {
  const createdDate = formatPageDate(page.createdAt, locale)
  const createdText = page.creatorName
    ? t('createdBy', { date: createdDate, name: page.creatorName })
    : t('createdOn', { date: createdDate })
  const publishedDate = page.publishedAt ? formatPageDate(page.publishedAt, locale) : ''
  const publishedText = publishedDate
    ? page.publisherName
      ? t('publishedBy', { date: publishedDate, name: page.publisherName })
      : t('publishedOn', { date: publishedDate })
    : ''
  if (!createdText && !publishedText) return null
  return (
    <p className="cms-page-byline">
      {createdText ? <time dateTime={page.createdAt}>{createdText}</time> : null}
      {createdText && publishedText ? ' · ' : null}
      {publishedText && page.publishedAt ? (
        <time dateTime={page.publishedAt}>{publishedText}</time>
      ) : null}
    </p>
  )
}

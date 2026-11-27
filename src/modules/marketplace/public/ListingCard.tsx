import Link from 'next/link'
import React from 'react'

type Props = {
  href: string
  title: string
  priceLabel: string
  conditionLabel: string
  areaLabel: string
  thumbSrc?: string
  /** Optional status / distance chip under the area line. */
  footnote?: string
  /** Actions outside the link (Edit, Unsave). */
  actions?: React.ReactNode
}

/** Shared browse / You listing card — photo, price first, then title and facts. */
export function ListingCard({
  href,
  title,
  priceLabel,
  conditionLabel,
  areaLabel,
  thumbSrc = '',
  footnote,
  actions,
}: Props) {
  return (
    <li className="sf-marketplace-card">
      <Link href={href} className="sf-marketplace-card-link">
        {thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbSrc} alt="" className="sf-marketplace-card-media" />
        ) : (
          <span className="sf-marketplace-card-media is-empty" aria-hidden>
            <span className="sf-marketplace-card-media-empty">No photo</span>
          </span>
        )}
        <span className="sf-marketplace-card-body">
          <span className="sf-marketplace-card-price">{priceLabel}</span>
          <strong className="sf-marketplace-card-title">{title}</strong>
          <span className="sf-marketplace-card-meta">{conditionLabel}</span>
          <span className="sf-marketplace-card-area">
            {areaLabel.trim() || 'Area not set'}
          </span>
          {footnote ? (
            <span className="sf-marketplace-card-footnote">{footnote}</span>
          ) : null}
        </span>
      </Link>
      {actions ? (
        <div className="sf-marketplace-card-actions">{actions}</div>
      ) : null}
    </li>
  )
}

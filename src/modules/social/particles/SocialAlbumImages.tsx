import Link from 'next/link'
import React from 'react'

export type SocialAlbumImageCard = {
  key: string
  href: string
  imageSrc: string
  title: string
}

/** Albums / images particle — image-only tiles. */
export function SocialAlbumImages({
  items,
  emptyMessage,
}: {
  items: SocialAlbumImageCard[]
  emptyMessage: string
}) {
  if (items.length === 0) {
    return <p className="layout-muted">{emptyMessage}</p>
  }

  return (
    <ul className="sf-social-albums-particle-list">
      {items.map((item) => (
        <li key={item.key} className="sf-social-albums-particle-item">
          <Link
            href={item.href}
            className="sf-social-albums-particle-link"
            aria-label={item.title}
            title={item.title}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Media ids are runtime URLs */}
            <img
              src={item.imageSrc}
              alt=""
              className="sf-social-albums-particle-image"
              width={120}
              height={120}
            />
          </Link>
        </li>
      ))}
    </ul>
  )
}

import Link from 'next/link'
import React from 'react'

export type SocialEntityCard = {
  key: string
  href: string
  title: string
  imageSrc: string | null
  avatarSrc: string | null
  avatarLabel: string
}

/**
 * Page / group particle row: cover (optional) + small avatar under it on the left,
 * title on one line to the right.
 */
export function SocialEntityCards({
  items,
  showImages,
  emptyMessage,
  className,
}: {
  items: SocialEntityCard[]
  showImages: boolean
  emptyMessage: string
  className: string
}) {
  if (items.length === 0) {
    return <p className="layout-muted">{emptyMessage}</p>
  }

  return (
    <ul className={`${className}-list sf-social-entity-list`}>
      {items.map((item) => {
        const initial = item.avatarLabel.trim().slice(0, 1).toUpperCase() || '?'
        return (
          <li key={item.key} className={`${className}-item sf-social-entity-item`}>
            <Link href={item.href} className={`${className}-link sf-social-entity-link`}>
              <span className="sf-social-entity-media" aria-hidden={!showImages && !item.avatarSrc}>
                {showImages ? (
                  item.imageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Media ids are runtime URLs
                    <img
                      src={item.imageSrc}
                      alt=""
                      className="sf-social-entity-cover"
                      width={72}
                      height={48}
                    />
                  ) : (
                    <span className="sf-social-entity-cover sf-social-entity-cover-empty" />
                  )
                ) : null}
                {item.avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.avatarSrc}
                    alt=""
                    className="sf-social-entity-avatar"
                    width={28}
                    height={28}
                  />
                ) : (
                  <span className="sf-social-entity-avatar sf-social-entity-avatar-empty">
                    {initial}
                  </span>
                )}
              </span>
              <span className={`${className}-name sf-social-entity-title`}>{item.title}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

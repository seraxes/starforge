import React from 'react'
import Link from 'next/link'

/** Circular avatar used at the start of posts and replies. */
export function SocialAvatar({
  src,
  href,
  size = 40,
  label,
}: {
  src?: string | null
  href?: string | null
  size?: number
  /** Accessible name when the avatar is the only link target. */
  label?: string
}) {
  const image = src?.trim() ? (
    // eslint-disable-next-line @next/next/no-img-element -- Media library redirect
    <img
      src={src.trim()}
      alt=""
      className="sf-social-avatar-img"
      width={size}
      height={size}
    />
  ) : (
    <span className="sf-social-avatar-empty" aria-hidden />
  )

  const className = 'sf-social-avatar'
  const style = {
    width: size,
    height: size,
    ['--sf-social-avatar-size' as string]: `${size}px`,
  } as React.CSSProperties

  if (href?.trim()) {
    return (
      <Link
        href={href.trim()}
        className={className}
        style={style}
        aria-label={label}
        tabIndex={label ? undefined : -1}
      >
        {image}
      </Link>
    )
  }

  return (
    <span className={className} style={style} aria-hidden={!label} aria-label={label}>
      {image}
    </span>
  )
}

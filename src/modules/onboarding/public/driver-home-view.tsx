import Link from 'next/link'
import React from 'react'

export type DriverHomeTile = {
  id: string
  title: string
  icon: string
  url: string
}

export function DriverHomeView({
  label,
  actionChip,
  nextStep,
  tiles,
}: {
  label: string
  actionChip: string
  nextStep: string
  tiles: DriverHomeTile[]
}) {
  return (
    <section className="sf-driver-home-particle" aria-label={label || 'Onboarding'}>
      {label ? <h2 className="sf-driver-home-heading">{label}</h2> : null}
      {actionChip ? (
        <p className="sf-driver-home-chip">
          <span className="sf-driver-home-chip-label">{actionChip}</span>
        </p>
      ) : null}
      {nextStep ? <p className="sf-driver-home-message">{nextStep}</p> : null}
      {tiles.length > 0 ? (
        <ul className="sf-driver-home-tiles">
          {tiles.map((tile) => (
            <li key={tile.id} className="sf-driver-home-tile">
              {tile.url.trim() ? (
                <Link href={tile.url.trim()} className="sf-driver-home-tile-link">
                  {tile.icon.trim() ? (
                    <span className="sf-driver-home-tile-icon" aria-hidden data-icon={tile.icon.trim()}>
                      {tile.icon.trim()}
                    </span>
                  ) : null}
                  <span className="sf-driver-home-tile-title">{tile.title}</span>
                </Link>
              ) : (
                <span className="sf-driver-home-tile-link">
                  {tile.icon.trim() ? (
                    <span className="sf-driver-home-tile-icon" aria-hidden data-icon={tile.icon.trim()}>
                      {tile.icon.trim()}
                    </span>
                  ) : null}
                  <span className="sf-driver-home-tile-title">{tile.title}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

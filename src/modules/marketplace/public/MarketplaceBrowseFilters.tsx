'use client'

import React, { useMemo, useState } from 'react'

import { majorToMinor, minorToMajor } from '@/core/payments/money'
import type { BrowseFilters, BrowseSort } from '../browse-rules'

export type MarketplaceBrowseCategory = {
  id: string
  title: string
}

type Props = {
  categories: MarketplaceBrowseCategory[]
  filters: BrowseFilters
  currency: string
  /** Raw search-param strings for uncontrolled defaults. */
  defaults: {
    q: string
    lat: string
    lng: string
    distance: string
  }
}

/**
 * Compact public browse filter bar.
 * Distance / near-me fields appear only when sort is Distance.
 * On narrow viewports the fields collapse behind Filters.
 */
export function MarketplaceBrowseFilters({
  categories,
  filters,
  currency,
  defaults,
}: Props) {
  const [sort, setSort] = useState<BrowseSort>(filters.sort || 'newest')
  const [open, setOpen] = useState(false)
  const showNearMe = sort === 'distance'

  const priceMinMajor = useMemo(() => {
    if (filters.priceMinMinor == null || !Number.isFinite(filters.priceMinMinor)) {
      return ''
    }
    return String(minorToMajor(filters.priceMinMinor, currency))
  }, [filters.priceMinMinor, currency])

  const priceMaxMajor = useMemo(() => {
    if (filters.priceMaxMinor == null || !Number.isFinite(filters.priceMaxMinor)) {
      return ''
    }
    return String(minorToMajor(filters.priceMaxMinor, currency))
  }, [filters.priceMaxMinor, currency])

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget
    const minEl = form.elements.namedItem('priceMin') as HTMLInputElement | null
    const maxEl = form.elements.namedItem('priceMax') as HTMLInputElement | null
    if (minEl && minEl.value.trim() !== '') {
      const major = Number(minEl.value)
      if (Number.isFinite(major)) {
        const minor = majorToMinor(major, currency)
        minEl.value = minor == null ? '' : String(minor)
      }
    }
    if (maxEl && maxEl.value.trim() !== '') {
      const major = Number(maxEl.value)
      if (Number.isFinite(major)) {
        const minor = majorToMinor(major, currency)
        maxEl.value = minor == null ? '' : String(minor)
      }
    }
  }

  return (
    <form
      className={`sf-marketplace-filters${open ? ' is-open' : ''}`}
      method="get"
      onSubmit={onSubmit}
    >
      <div className="sf-marketplace-filters-toolbar">
        <button
          type="button"
          className="sf-marketplace-filters-toggle secondary"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide filters' : 'Filters'}
        </button>
        <button type="submit" className="sf-marketplace-filters-apply secondary">
          Apply
        </button>
      </div>

      <div className="sf-marketplace-filters-bar">
        <label className="settings-field sf-marketplace-filter-search">
          <span>Search</span>
          <input name="q" type="search" defaultValue={defaults.q} />
        </label>
        <label className="settings-field">
          <span>Category</span>
          <select name="category" defaultValue={filters.categoryId || ''}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-field">
          <span>Condition</span>
          <select name="condition" defaultValue={filters.condition || ''}>
            <option value="">Any</option>
            <option value="new">New</option>
            <option value="used">Used</option>
            <option value="refurbished">Refurbished</option>
          </select>
        </label>
        <label className="settings-field sf-marketplace-filter-price">
          <span>Min price</span>
          <input
            name="priceMin"
            type="number"
            min={0}
            step="any"
            defaultValue={priceMinMajor}
            inputMode="decimal"
          />
        </label>
        <label className="settings-field sf-marketplace-filter-price">
          <span>Max price</span>
          <input
            name="priceMax"
            type="number"
            min={0}
            step="any"
            defaultValue={priceMaxMajor}
            inputMode="decimal"
          />
        </label>
        <label className="settings-field">
          <span>Sort</span>
          <select
            name="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as BrowseSort)}
          >
            <option value="newest">Newest</option>
            <option value="price">Price</option>
            <option value="distance">Distance</option>
          </select>
        </label>
        <button
          type="submit"
          className="sf-marketplace-filters-apply-inline secondary"
        >
          Apply
        </button>
      </div>

      {showNearMe ? (
        <fieldset className="sf-marketplace-near-me">
          <legend>Near me</legend>
          <p className="settings-hint">
            Used for distance sort only. Listings still show the area label — never a
            street address.
          </p>
          <div className="sf-marketplace-near-me-row">
            <label className="settings-field">
              <span>Latitude</span>
              <input
                name="lat"
                type="number"
                step="any"
                defaultValue={
                  defaults.lat ||
                  (filters.viewer?.latitude != null ? String(filters.viewer.latitude) : '')
                }
              />
            </label>
            <label className="settings-field">
              <span>Longitude</span>
              <input
                name="lng"
                type="number"
                step="any"
                defaultValue={
                  defaults.lng ||
                  (filters.viewer?.longitude != null
                    ? String(filters.viewer.longitude)
                    : '')
                }
              />
            </label>
            <label className="settings-field">
              <span>Max km</span>
              <input
                name="distance"
                type="number"
                min={0}
                step="any"
                defaultValue={
                  defaults.distance ||
                  (filters.maxDistanceKm != null && Number.isFinite(filters.maxDistanceKm)
                    ? String(filters.maxDistanceKm)
                    : '')
                }
              />
            </label>
          </div>
        </fieldset>
      ) : null}
    </form>
  )
}

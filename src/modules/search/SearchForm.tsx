import React from 'react'

export type SearchFormProps = {
  /** Current query (for /search page re-display). */
  query?: string
  placeholder?: string
  buttonLabel?: string
  /** Optional visible heading (particle). */
  heading?: string
  /** Compact layout for header/nav slots. */
  compact?: boolean
  className?: string
  /** Form action — defaults to /search. */
  action?: string
}

/**
 * GET form → `/search?q=…`. Works without JS (progressive enhancement).
 */
export function SearchForm({
  query = '',
  placeholder = 'Search pages…',
  buttonLabel = 'Search',
  heading = '',
  compact = false,
  className = '',
  action = '/search',
}: SearchFormProps) {
  const classes = ['sf-search-form', compact ? 'sf-search-form--compact' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      {heading.trim() ? <h2 className="sf-search-form-heading">{heading.trim()}</h2> : null}
      <form className="sf-search-form-row" method="get" action={action} role="search">
        <label className="sf-search-form-label">
          <span className="visually-hidden">Search</span>
          <input
            className="sf-search-form-input"
            type="search"
            name="q"
            defaultValue={query}
            placeholder={placeholder}
            maxLength={100}
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
        <button className="sf-search-form-submit" type="submit">
          {buttonLabel}
        </button>
      </form>
    </div>
  )
}

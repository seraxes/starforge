import React from 'react'

import { areaPath, donutSlices, linePath, plotPoints, type SeriesPoint } from './series'

function sparkValues(values: readonly number[]): number[] {
  return values.length > 0 ? [...values] : [0, 0]
}

/** White area sparkline for a solid stat tile. */
export function DashboardSparkline(props: { values: readonly number[]; title: string }) {
  const width = 128
  const height = 40
  const points = plotPoints(sparkValues(props.values), width, height, 2)
  const line = linePath(points)
  const area = areaPath(points, height - 1)
  return (
    <svg
      className="sf-dash-spark"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={props.title}
      preserveAspectRatio="none"
    >
      <path d={area} fill="rgba(255,255,255,0.22)" />
      <path
        d={line}
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Share bar used when a metric has no time series (online now). */
export function DashboardMeter(props: { value: number; max: number; label: string }) {
  const pct =
    props.max <= 0 ? 0 : Math.max(0, Math.min(100, (props.value / props.max) * 100))
  return (
    <div className="sf-dash-meter" role="img" aria-label={props.label}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Monthly area chart on the navy panel. */
export function DashboardAreaChart(props: {
  points: readonly SeriesPoint[]
  color: string
  label: string
}) {
  const width = 640
  const height = 214
  const padL = 36
  const padR = 10
  const padT = 12
  const padB = 28
  const plotW = width - padL - padR
  const plotH = height - padT - padB
  const values = props.points.map((point) => point.value)
  const plotted = plotPoints(values.length > 0 ? values : [0], plotW, plotH, 0).map((point) => ({
    x: point.x + padL,
    y: point.y + padT,
  }))
  const baseline = padT + plotH
  const max = Math.max(1, ...values, 0)
  const mid = Math.round(max / 2)
  const ticks = mid === 0 || mid === max ? [max, 0] : [max, mid, 0]
  const gradientId = 'sf-dash-area-fill'

  return (
    <svg
      className="sf-dash-area"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={props.label}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={props.color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={props.color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {ticks.map((tick, index) => {
        const y = baseline - (tick / max) * plotH
        return (
          <g key={`${tick}-${index}`}>
            <line
              x1={padL}
              x2={width - padR}
              y1={y}
              y2={y}
              stroke="rgba(158,177,199,0.22)"
              strokeWidth="1"
            />
            <text x={padL - 8} y={y + 4} textAnchor="end" className="sf-dash-axis">
              {tick}
            </text>
          </g>
        )
      })}
      <path d={areaPath(plotted, baseline)} fill={`url(#${gradientId})`} />
      <path
        d={linePath(plotted)}
        fill="none"
        stroke={props.color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {props.points.map((point, index) => {
        const plottedPoint = plotted[index]
        if (!plottedPoint) return null
        return (
          <text
            key={point.key}
            x={plottedPoint.x}
            y={height - 8}
            textAnchor="middle"
            className="sf-dash-axis"
          >
            {point.label}
          </text>
        )
      })}
    </svg>
  )
}

export function DashboardDonut(props: {
  values: readonly number[]
  colors: readonly string[]
  totalLabel: string
  total: string
}) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const slices = donutSlices(props.values)
  return (
    <div className="sf-dash-donut">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="rgba(158,177,199,0.18)"
          strokeWidth="14"
        />
        {slices.map((slice, index) =>
          slice.frac <= 0 ? null : (
            <circle
              key={index}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={props.colors[index] ?? props.colors[0]}
              strokeWidth="14"
              strokeDasharray={`${slice.frac * circumference} ${circumference}`}
              strokeDashoffset={-slice.offset * circumference}
              strokeLinecap="butt"
              transform="rotate(-90 60 60)"
            />
          ),
        )}
      </svg>
      <div className="sf-dash-donut-total">
        <strong>{props.total}</strong>
        <span>{props.totalLabel}</span>
      </div>
    </div>
  )
}

export function DashboardLegend(props: {
  rows: readonly { label: string; value: number; color: string }[]
}) {
  const total = props.rows.reduce((sum, row) => sum + Math.max(0, row.value), 0)
  return (
    <ul className="sf-dash-legend-rows">
      {props.rows.map((row) => {
        const pct = total <= 0 ? 0 : Math.round((row.value / total) * 1000) / 10
        return (
          <li key={row.label}>
            <span className="sf-dash-swatch" style={{ background: row.color }} />
            <span className="sf-dash-legend-name">{row.label}</span>
            <span className="sf-dash-legend-track" aria-hidden="true">
              <span style={{ width: `${pct}%`, background: row.color }} />
            </span>
            <span className="sf-dash-legend-pct">{total <= 0 ? '0%' : `${pct}%`}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function DashboardBars(props: {
  rows: readonly { label: string; value: number; color: string }[]
}) {
  const max = Math.max(1, ...props.rows.map((row) => row.value), 0)
  return (
    <ul className="sf-dash-bars">
      {props.rows.map((row) => (
        <li key={row.label}>
          <span className="sf-dash-bars-label">{row.label}</span>
          <span className="sf-dash-bars-track" aria-hidden="true">
            <span
              style={{
                width: `${Math.max(0, Math.min(100, (row.value / max) * 100))}%`,
                background: row.color,
              }}
            />
          </span>
          <span className="sf-dash-bars-value">{row.value}</span>
        </li>
      ))}
    </ul>
  )
}

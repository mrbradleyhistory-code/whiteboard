/** Shape kinds and SVG rendering for the whiteboard shape tool. */

import React from 'react'

export const SHAPE_KINDS = [
  { id: 'rect', label: 'Rectangle', icon: '▭' },
  { id: 'ellipse', label: 'Oval', icon: '⬭' },
  { id: 'diamond', label: 'Diamond', icon: '◆' },
  { id: 'star', label: 'Star', icon: '★' },
  { id: 'arrow-right', label: 'Arrow →', icon: '→' },
  { id: 'arrow-left', label: 'Arrow ←', icon: '←' },
  { id: 'arrow-up', label: 'Arrow ↑', icon: '↑' },
  { id: 'arrow-down', label: 'Arrow ↓', icon: '↓' },
]

const STAR = (() => {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 46 : 20
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push(`${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`)
  }
  return `M ${pts.join(' L ')} Z`
})()

export const SHAPE_PATHS = {
  ellipse: null,
  rect: null,
  diamond: 'M50,4 L96,50 L50,96 L4,50 Z',
  star: STAR,
  'arrow-right': 'M4,28 L58,28 L58,12 L96,50 L58,88 L58,72 L4,72 Z',
  'arrow-left': 'M96,28 L42,28 L42,12 L4,50 L42,88 L42,72 L96,72 Z',
  'arrow-up': 'M28,96 L28,42 L12,42 L50,4 L88,42 L72,42 L72,96 Z',
  'arrow-down': 'M28,4 L28,58 L12,58 L50,96 L88,58 L72,58 L72,4 Z',
}

export function createShapeFields(overrides = {}) {
  return {
    kind: overrides.kind || 'rect',
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    width: overrides.width ?? 160,
    height: overrides.height ?? 120,
    fillColor: overrides.fillColor ?? '#e8f2f8',
    strokeColor: overrides.strokeColor ?? '#457b9d',
    strokeWidth: overrides.strokeWidth ?? 2,
    text: overrides.text ?? '',
    fontSize: overrides.fontSize ?? 16,
    textColor: overrides.textColor ?? '#1a1f26',
    fontFamily: overrides.fontFamily ?? 'system-ui, sans-serif',
    bold: !!overrides.bold,
    italic: !!overrides.italic,
    underline: !!overrides.underline,
    textAlign: overrides.textAlign ?? 'center',
    listStyle: overrides.listStyle ?? 'none',
  }
}

export function ShapeGraphic({ kind, fillColor, strokeColor, strokeWidth = 2, style }) {
  const sw = strokeWidth
  const common = {
    fill: fillColor,
    stroke: strokeColor,
    strokeWidth: sw,
    vectorEffect: 'non-scaling-stroke',
  }

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none', ...style }}
      aria-hidden
    >
      {kind === 'rect' ? (
        <rect x="1.5" y="1.5" width="97" height="97" rx="6" {...common} />
      ) : kind === 'ellipse' ? (
        <ellipse cx="50" cy="50" rx="48" ry="48" {...common} />
      ) : (
        <path d={SHAPE_PATHS[kind] || SHAPE_PATHS.diamond} {...common} strokeLinejoin="round" />
      )}
    </svg>
  )
}

import { useMemo, useState } from 'react'
import { fmt } from '../lib/format'
import type { Level } from '../sim/types'
import { useMarket, useWorkspace } from '../stores/app'
import { useBook } from '../stores/market'
import { useCommitCounter } from './Perf'

const W = 300
const H = 150

/** Cumulative size from the best price outwards: [price, total][] */
const cumulate = (levels: readonly Level[] | undefined, limit: number, inside: (price: number) => boolean) => {
  const out: [number, number][] = []
  let total = 0
  for (const [price, size] of levels ?? []) {
    if (out.length >= limit || !inside(price)) break
    total += size
    out.push([price, total])
  }
  return out
}

export function DepthChart() {
  useCommitCounter('depth chart')
  const { symbol } = useWorkspace()
  const decimals = useMarket(symbol)?.priceDecimals ?? 2
  const { bids, asks, mid } = useBook({ symbol })
  // how much of the book to show, around the mid
  const [zoom, setZoom] = useState(0.5)

  const chart = useMemo(() => {
    const deepest = Math.max(mid !== undefined ? mid - (bids?.at(-1)?.[0] ?? mid) : 0, mid !== undefined ? (asks?.at(-1)?.[0] ?? mid) - mid : 0)
    if (!mid || !deepest) return undefined
    const lo = mid - deepest * zoom
    const hi = mid + deepest * zoom
    const b = cumulate(bids, 400, p => p >= lo)
    const a = cumulate(asks, 400, p => p <= hi)
    const max = Math.max(b.at(-1)?.[1] ?? 0, a.at(-1)?.[1] ?? 0) || 1
    const x = (p: number) => ((p - lo) / (hi - lo)) * W
    const y = (v: number) => H - (v / max) * (H - 10)
    // a step line: flat until the next price, then up by its size
    const path = (points: [number, number][], edge: number) => {
      if (!points.length) return ''
      let d = `M${x(points[0]![0])},${H}`
      let prev = 0
      for (const [p, v] of points) d += `L${x(p)},${y(prev)}L${x(p)},${y(v)}`, prev = v
      return `${d}L${x(edge)},${y(prev)}L${x(edge)},${H}Z`
    }
    return { bidPath: path(b, lo), askPath: path(a, hi), lo, hi, max }
  }, [bids, asks, mid, zoom])

  return (
    <section className="panel depth">
      <div className="panel-head">
        <span className="panel-title">Depth</span>
        <div className="tabs small">
          {[0.25, 0.5, 1].map(z => (
            <button key={z} className={zoom === z ? 'on' : ''} onClick={() => setZoom(z)}>{z === 1 ? 'all' : `${z * 100}%`}</button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="depth-svg">
        {chart && <>
          <path d={chart.bidPath} className="depth-bid" />
          <path d={chart.askPath} className="depth-ask" />
          <line x1={W / 2} x2={W / 2} y1={0} y2={H} className="depth-mid" />
        </>}
      </svg>
      <div className="depth-axis muted">
        <span>{fmt(chart?.lo, decimals)}</span>
        <span>{fmt(mid, decimals)}</span>
        <span>{fmt(chart?.hi, decimals)}</span>
      </div>
    </section>
  )
}

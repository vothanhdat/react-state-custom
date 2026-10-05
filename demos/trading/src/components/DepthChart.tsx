import { useState } from 'react'
import { fmt } from '../lib/format'
import { useDepth } from '../stores/ui/marketViews'
import { useWorkspace } from '../stores/ui/workspace'
import { useCommitCounter } from './Perf'

const W = 300
const H = 150

export function DepthChart() {
  const { symbol } = useWorkspace()
  // the workspace publishes its symbol once it runs, before the first paint
  return symbol ? <Depth symbol={symbol} /> : <section className="panel depth" />
}

function Depth({ symbol }: { symbol: string }) {
  useCommitCounter('depth chart')
  // how much of the book to show, around the mid
  const [zoom, setZoom] = useState(0.5)
  const { view, mid, decimals } = useDepth(symbol, zoom)

  // geometry belongs to the view: the view-model gives prices and totals, this maps them to the SVG
  const chart = (() => {
    if (!view) return undefined
    const { lo, hi, max } = view
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
    return { bidPath: path(view.bidPoints, lo), askPath: path(view.askPoints, hi), lo, hi }
  })()

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

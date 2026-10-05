import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fmt, fmtCompact } from '../lib/format'
import type { OrderLine } from '../domain/orders'
import type { Candle } from '../sim/types'
import { useChart } from '../stores/ui/marketViews'
import { INTERVALS, useWorkspace } from '../stores/ui/workspace'
import { useCommitCounter } from './Perf'

const intervalLabel = (s: number) => (s < 60 ? `${s}s` : `${s / 60}m`)

export function ChartPanel() {
  const { symbol, chartInterval, setChartInterval } = useWorkspace()
  return (
    <section className="panel chart-panel">
      <div className="panel-head">
        <span className="panel-title">{symbol}</span>
        <div className="tabs small">
          {INTERVALS.map(i => (
            <button key={i} className={chartInterval === i ? 'on' : ''} onClick={() => setChartInterval?.(i)}>{intervalLabel(i)}</button>
          ))}
        </div>
        <span className="hint">scroll to zoom · drag to pan · double-click to reset</span>
      </div>
      {/* zoom and pan belong to one chart: a new symbol or interval starts from the default view */}
      {symbol && chartInterval && <CandleChart key={`${symbol}:${chartInterval}`} symbol={symbol} interval={chartInterval} />}
    </section>
  )
}

type View = { count: number; offset: number }
const DEFAULT_VIEW: View = { count: 90, offset: 0 }

function CandleChart({ symbol, interval }: { symbol: string; interval: number }) {
  useCommitCounter('chart')
  const { candles, loading, error, retry, decimals, lines } = useChart(symbol, interval)

  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [view, setView] = useState(DEFAULT_VIEW)
  // the pointer moves far more often than anything else: it redraws without rendering
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const drag = useRef<{ x: number; offset: number } | null>(null)
  const draw = useRef<() => void>(() => {})

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) })
    })
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  // wheel listeners must be non-passive to stop the page from scrolling
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setView(v => ({ ...v, count: Math.round(Math.min(400, Math.max(20, v.count * (e.deltaY > 0 ? 1.12 : 1 / 1.12)))) }))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  useLayoutEffect(() => {
    draw.current = () => {
      const canvas = canvasRef.current
      if (canvas && candles) paint(canvas, size, candles, view, lines, decimals, interval, pointer.current)
    }
    draw.current()
  })

  const plotWidth = size.width - AXIS_RIGHT

  return (
    <div className="chart-box" ref={boxRef}>
      <canvas
        ref={canvasRef}
        style={{ width: size.width, height: size.height }}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { x: e.clientX, offset: view.offset }
        }}
        onPointerMove={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          pointer.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
          const start = drag.current
          if (start && candles) {
            const perCandle = plotWidth / view.count
            const max = Math.max(0, candles.length - 10)
            setView(v => ({ ...v, offset: Math.min(max, Math.max(0, start.offset + (e.clientX - start.x) / perCandle)) }))
          } else {
            draw.current()
          }
        }}
        onPointerUp={() => { drag.current = null }}
        onPointerLeave={() => { pointer.current = null; draw.current() }}
        onDoubleClick={() => setView(DEFAULT_VIEW)}
      />
      {loading && <div className="overlay">Loading candles…</div>}
      {error && <div className="overlay">{error} <button onClick={retry}>Retry</button></div>}
      {view.offset > 0 && <button className="chart-live" onClick={() => setView(v => ({ ...v, offset: 0 }))}>Live ⟶</button>}
    </div>
  )
}

// ---------------------------------------------------------------- canvas

const AXIS_RIGHT = 72
const AXIS_BOTTOM = 22

const niceStep = (range: number, targetTicks: number) => {
  const raw = range / targetTicks
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
}

const timeLabel = (t: number, interval: number) =>
  new Date(t * 1000).toLocaleTimeString('en-GB', { hour12: false, ...(interval >= 60 ? { second: undefined } : {}) })

function paint(
  canvas: HTMLCanvasElement,
  size: { width: number; height: number },
  candles: Candle[],
  view: View,
  lines: OrderLine[],
  decimals: number,
  interval: number,
  pointer: { x: number; y: number } | null,
) {
  const { width, height } = size
  if (width <= 0 || height <= 0) return
  const dpr = window.devicePixelRatio || 1
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr
    canvas.height = height * dpr
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const css = getComputedStyle(canvas)
  const color = (name: string) => css.getPropertyValue(name).trim()
  const up = color('--up')
  const down = color('--down')
  const muted = color('--muted')
  const grid = color('--grid')
  const text = color('--text')

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'

  const plotW = width - AXIS_RIGHT
  const plotH = height - AXIS_BOTTOM
  const volumeH = plotH * 0.18
  const priceH = plotH - volumeH - 8

  const end = Math.max(0, candles.length - Math.floor(view.offset))
  const start = Math.max(0, end - view.count)
  const visible = candles.slice(start, end)
  if (!visible.length) return

  let lo = Infinity
  let hi = -Infinity
  let maxVol = 0
  for (const c of visible) {
    lo = Math.min(lo, c.l)
    hi = Math.max(hi, c.h)
    maxVol = Math.max(maxVol, c.v)
  }
  const pad = (hi - lo) * 0.08 || hi * 0.001
  lo -= pad
  hi += pad
  const y = (p: number) => 6 + ((hi - p) / (hi - lo)) * priceH
  const priceAt = (py: number) => hi - ((py - 6) / priceH) * (hi - lo)
  const slot = plotW / view.count
  // the newest candle sits at the right edge, older ones to its left
  const x = (i: number) => plotW - (visible.length - i - 0.5) * slot

  // grid and price axis
  ctx.strokeStyle = grid
  ctx.fillStyle = muted
  ctx.lineWidth = 1
  const step = niceStep(hi - lo, 6)
  for (let p = Math.ceil(lo / step) * step; p <= hi; p += step) {
    const py = Math.round(y(p)) + 0.5
    ctx.beginPath()
    ctx.moveTo(0, py)
    ctx.lineTo(plotW, py)
    ctx.stroke()
    ctx.fillText(fmt(p, decimals), plotW + 6, py + 4)
  }
  // time axis: a label every ~90px
  const every = Math.max(1, Math.round(90 / slot))
  for (let i = 0; i < visible.length; i++) {
    const c = visible[i]
    if (!c || (start + i) % every) continue
    const px = Math.round(x(i)) + 0.5
    ctx.beginPath()
    ctx.moveTo(px, 0)
    ctx.lineTo(px, plotH)
    ctx.stroke()
    ctx.fillText(timeLabel(c.t, interval), px - 24, height - 6)
  }

  // volume and candles
  const body = Math.max(1, Math.floor(slot * 0.7))
  for (let i = 0; i < visible.length; i++) {
    const c = visible[i]
    if (!c) continue
    const px = Math.round(x(i))
    const rising = c.c >= c.o
    ctx.fillStyle = rising ? up : down
    ctx.globalAlpha = 0.25
    const vh = maxVol ? (c.v / maxVol) * volumeH : 0
    ctx.fillRect(px - body / 2, plotH - vh, body, vh)
    ctx.globalAlpha = 1
    ctx.fillRect(px, y(c.h), 1, Math.max(1, y(c.l) - y(c.h)))
    const top = y(Math.max(c.o, c.c))
    ctx.fillRect(px - Math.floor(body / 2), top, body, Math.max(1, y(Math.min(c.o, c.c)) - top))
  }

  const tag = (py: number, label: string, background: string) => {
    ctx.fillStyle = background
    ctx.fillRect(plotW, py - 9, AXIS_RIGHT, 18)
    ctx.fillStyle = '#fff'
    ctx.fillText(label, plotW + 6, py + 4)
  }

  // the user's resting orders
  ctx.setLineDash([4, 4])
  for (const line of lines) {
    if (line.price < lo || line.price > hi) continue
    const py = Math.round(y(line.price)) + 0.5
    const c = line.side === 'buy' ? up : down
    ctx.strokeStyle = c
    ctx.beginPath()
    ctx.moveTo(0, py)
    ctx.lineTo(plotW, py)
    ctx.stroke()
    ctx.fillStyle = c
    ctx.fillText(`${line.side.toUpperCase()} ${line.size}`, 6, py - 4)
    tag(py, fmt(line.price, decimals), c)
  }

  // last price
  const last = visible[visible.length - 1]
  if (last && view.offset < 1) {
    const py = Math.round(y(last.c)) + 0.5
    ctx.strokeStyle = last.c >= last.o ? up : down
    ctx.beginPath()
    ctx.moveTo(0, py)
    ctx.lineTo(plotW, py)
    ctx.stroke()
    tag(py, fmt(last.c, decimals), last.c >= last.o ? up : down)
  }
  ctx.setLineDash([])

  // crosshair and the hovered candle
  if (pointer && pointer.x < plotW && pointer.y < plotH) {
    ctx.strokeStyle = muted
    ctx.setLineDash([2, 3])
    ctx.beginPath()
    ctx.moveTo(pointer.x, 0)
    ctx.lineTo(pointer.x, plotH)
    ctx.moveTo(0, pointer.y)
    ctx.lineTo(plotW, pointer.y)
    ctx.stroke()
    ctx.setLineDash([])
    tag(pointer.y, fmt(priceAt(pointer.y), decimals), muted)
    const i = Math.round(visible.length - 0.5 - (plotW - pointer.x) / slot)
    const c = visible[i]
    if (c) {
      ctx.fillStyle = text
      const change = c.c / c.o - 1
      ctx.fillText(
        `${timeLabel(c.t, interval)}  O ${fmt(c.o, decimals)}  H ${fmt(c.h, decimals)}  L ${fmt(c.l, decimals)}  C ${fmt(c.c, decimals)}  ${(change * 100).toFixed(2)}%  V ${fmtCompact(c.v)}`,
        8,
        16,
      )
    }
  }
}

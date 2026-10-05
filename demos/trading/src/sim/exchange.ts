// An in-memory exchange: market data over a socket-like API, an account with balances and
// orders over a REST-like API, and a matching engine for the user's orders. Everything a real
// venue makes hard for a frontend is here on purpose: latency, sequence gaps, reconnects,
// events that arrive before the REST response, rejections.

import { decimalsOf, isMultipleOf, roundTo } from '../lib/num'
import type {
  AccountMessage, AccountSnapshot, Balance, BookMessage, Candle, Channels, ConnectionStatus,
  Fill, Level, Market, Order, PlaceOrderRequest, Side, Ticker, Trade,
} from './types'

export const FEE_RATE = 0.001
/** The server rejects limit orders further than this from the last price */
export const PRICE_BAND = 0.1
const STEP_MS = 50
const BOOK_LEVELS = 80
const HISTORY_SECONDS = 2 * 3600
const TICKER_MS = 250

// ---------------------------------------------------------------- markets

type Spec = { base: string; price: number; tickSize: number; stepSize: number }

const MAJORS: Spec[] = [
  { base: 'BTC', price: 64_250, tickSize: 0.1, stepSize: 0.0001 },
  { base: 'ETH', price: 3_125, tickSize: 0.01, stepSize: 0.001 },
  { base: 'SOL', price: 146.2, tickSize: 0.01, stepSize: 0.01 },
  { base: 'BNB', price: 582.4, tickSize: 0.01, stepSize: 0.001 },
  { base: 'XRP', price: 0.5234, tickSize: 0.0001, stepSize: 1 },
  { base: 'ADA', price: 0.3812, tickSize: 0.0001, stepSize: 1 },
  { base: 'DOGE', price: 0.12345, tickSize: 0.00001, stepSize: 1 },
  { base: 'AVAX', price: 28.41, tickSize: 0.01, stepSize: 0.01 },
  { base: 'LINK', price: 13.52, tickSize: 0.001, stepSize: 0.1 },
  { base: 'DOT', price: 6.214, tickSize: 0.001, stepSize: 0.1 },
]

// a seeded generator, so the synthetic market list is the same on every load
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const syntheticSpecs = (count: number): Spec[] => {
  const random = seeded(7)
  const taken = new Set(MAJORS.map(s => s.base))
  const specs: Spec[] = []
  while (specs.length < count) {
    const length = random() < 0.6 ? 3 : 4
    let base = ''
    for (let i = 0; i < length; i++) base += String.fromCharCode(65 + Math.floor(random() * 26))
    if (taken.has(base)) continue
    taken.add(base)
    const price = Math.exp(Math.log(0.01) + random() * (Math.log(500) - Math.log(0.01)))
    const tickSize = 10 ** (Math.floor(Math.log10(price)) - 4)
    const stepSize = Math.min(1, 10 ** Math.floor(Math.log10(1 / price)))
    specs.push({ base, price: roundTo(price, decimalsOf(tickSize)), tickSize: roundTo(tickSize, 10), stepSize: roundTo(stepSize, 10) })
  }
  return specs
}

const gauss = () => {
  let u = 0
  while (u === 0) u = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random())
}

// ---------------------------------------------------------------- per-symbol simulation

type Sim = {
  market: Market
  mid: number
  sigma: number
  /** the book grid, in ticks */
  spacing: number
  baseSize: number
  bookLive: boolean
  bids: Map<number, number>
  asks: Map<number, number>
  bestBidT: number
  bestAskT: number
  seq: number
  changedBids: Set<number>
  changedAsks: Set<number>
  trades: Trade[]
  ticker: Ticker
  tickerDirty: boolean
  history?: Candle[]
  candles: Candle[]
  current: Candle
}

const nowSec = () => Math.floor(Date.now() / 1000)

const createSim = (spec: Spec, major: boolean): Sim => {
  const tickSize = spec.tickSize
  const market: Market = {
    symbol: `${spec.base}-USD`,
    base: spec.base,
    quote: 'USD',
    tickSize,
    stepSize: spec.stepSize,
    minNotional: 5,
    priceDecimals: decimalsOf(tickSize),
    sizeDecimals: decimalsOf(spec.stepSize),
    feeRate: FEE_RATE,
    priceBand: PRICE_BAND,
  }
  const open = roundTo(spec.price * Math.exp(gauss() * 0.03), market.priceDecimals)
  const t = nowSec()
  return {
    market,
    mid: spec.price,
    sigma: major ? 6e-5 : 1e-4,
    spacing: Math.max(1, Math.round((spec.price * 1e-5) / tickSize)),
    baseSize: 1500 / spec.price,
    bookLive: false,
    bids: new Map(),
    asks: new Map(),
    bestBidT: 0,
    bestAskT: 0,
    seq: 1,
    changedBids: new Set(),
    changedAsks: new Set(),
    trades: [],
    ticker: {
      symbol: market.symbol,
      last: spec.price,
      open,
      high: Math.max(open, spec.price) * (1 + Math.random() * 0.02),
      low: Math.min(open, spec.price) * (1 - Math.random() * 0.02),
      volume: (major ? 2e7 : 2e5) * (0.5 + Math.random()) / spec.price,
      ts: Date.now(),
    },
    tickerDirty: true,
    candles: [],
    current: { t, o: spec.price, h: spec.price, l: spec.price, c: spec.price, v: 0 },
  }
}

const sims = new Map<string, Sim>()
for (const spec of MAJORS) { const s = createSim(spec, true); sims.set(s.market.symbol, s) }
for (const spec of syntheticSpecs(190)) { const s = createSim(spec, false); sims.set(s.market.symbol, s) }

const sim = (symbol: string): Sim => {
  const s = sims.get(symbol)
  if (!s) throw new Error(`Unknown market ${symbol}`)
  return s
}

const priceOf = (s: Sim, ticks: number) => roundTo(ticks * s.market.tickSize, s.market.priceDecimals)
const ticksOf = (s: Sim, price: number) => Math.round(price / s.market.tickSize)
const sizeOf = (s: Sim, size: number) => Math.max(s.market.stepSize, roundTo(size, s.market.sizeDecimals))

const levelSize = (s: Sim, depth: number) =>
  sizeOf(s, s.baseSize * (0.15 + Math.random() ** 2 * 3) * (1 + depth / 25))

const setLevel = (s: Sim, side: Side, ticks: number, size: number) => {
  const book = side === 'buy' ? s.bids : s.asks
  if (size <= 0) {
    if (!book.delete(ticks)) return
  } else {
    book.set(ticks, size)
  }
  ;(side === 'buy' ? s.changedBids : s.changedAsks).add(ticks)
}

const pushTrade = (s: Sim, price: number, size: number, side: Side) => {
  const trade: Trade = { id: ++tradeId, price, size, side, ts: Date.now() }
  s.trades.push(trade)
  s.ticker.last = price
  s.ticker.high = Math.max(s.ticker.high, price)
  s.ticker.low = Math.min(s.ticker.low, price)
  s.ticker.volume += size
  s.tickerDirty = true
  s.current.v += size
}

let tradeId = 1

const rebuildBook = (s: Sim) => {
  s.bids.clear()
  s.asks.clear()
  const sp = s.spacing
  s.bestBidT = Math.floor(s.mid / s.market.tickSize / sp) * sp
  s.bestAskT = s.bestBidT + sp
  for (let i = 0; i < BOOK_LEVELS; i++) {
    if (i < 3 || Math.random() < 0.8) s.bids.set(s.bestBidT - i * sp, levelSize(s, i))
    if (i < 3 || Math.random() < 0.8) s.asks.set(s.bestAskT + i * sp, levelSize(s, i))
  }
  s.seq++
  s.changedBids.clear()
  s.changedAsks.clear()
  s.bookLive = true
}

const stepBook = (s: Sim) => {
  const sp = s.spacing
  const midT = s.mid / s.market.tickSize
  const bestBidT = Math.floor(midT / sp) * sp
  const bestAskT = bestBidT + sp * (Math.random() < 0.85 ? 1 : 2)

  if (Math.abs(bestBidT - s.bestBidT) > BOOK_LEVELS * sp) {
    rebuildBook(s)
    return
  }

  // the move took out the levels it crossed: one aggressive order swept them, printed at the last level
  let swept = 0
  let sweptT = 0
  for (let t = s.bestAskT; t < bestAskT; t += sp) {
    if (!s.asks.has(t)) continue
    swept++
    sweptT = t
    setLevel(s, 'sell', t, 0)
  }
  if (swept) pushTrade(s, priceOf(s, sweptT), sizeOf(s, s.baseSize * swept * 0.15 * Math.random()), 'buy')
  swept = 0
  for (let t = s.bestBidT; t > bestBidT; t -= sp) {
    if (!s.bids.has(t)) continue
    swept++
    sweptT = t
    setLevel(s, 'buy', t, 0)
  }
  if (swept) pushTrade(s, priceOf(s, sweptT), sizeOf(s, s.baseSize * swept * 0.15 * Math.random()), 'sell')
  // a bid at or above the new best ask (or an ask at or below the best bid) cannot rest
  for (let t = bestAskT; t <= s.bestBidT; t += sp) setLevel(s, 'buy', t, 0)
  for (let t = bestBidT; t >= s.bestAskT; t -= sp) setLevel(s, 'sell', t, 0)

  // levels that fell out of the visible depth
  for (let t = s.bestBidT - (BOOK_LEVELS - 1) * sp; t < bestBidT - (BOOK_LEVELS - 1) * sp; t += sp) setLevel(s, 'buy', t, 0)
  for (let t = s.bestAskT + (BOOK_LEVELS - 1) * sp; t > bestAskT + (BOOK_LEVELS - 1) * sp; t -= sp) setLevel(s, 'sell', t, 0)

  s.bestBidT = bestBidT
  s.bestAskT = bestAskT
  if (!s.bids.has(bestBidT)) setLevel(s, 'buy', bestBidT, levelSize(s, 0))
  if (!s.asks.has(bestAskT)) setLevel(s, 'sell', bestAskT, levelSize(s, 0))

  for (let i = 1; i < BOOK_LEVELS; i++) {
    const p = i < 10 ? 0.4 : 0.05
    if (!s.bids.has(bestBidT - i * sp) && Math.random() < p) setLevel(s, 'buy', bestBidT - i * sp, levelSize(s, i))
    if (!s.asks.has(bestAskT + i * sp) && Math.random() < p) setLevel(s, 'sell', bestAskT + i * sp, levelSize(s, i))
  }

  // makers moving their orders around, mostly near the top
  for (let k = 0; k < 6; k++) {
    const i = Math.floor(Math.random() ** 2 * BOOK_LEVELS)
    const side: Side = k % 2 ? 'buy' : 'sell'
    const t = side === 'buy' ? bestBidT - i * sp : bestAskT + i * sp
    const book = side === 'buy' ? s.bids : s.asks
    const size = book.get(t)
    if (size === undefined) continue
    if (i > 0 && Math.random() < 0.15) setLevel(s, side, t, 0)
    else setLevel(s, side, t, sizeOf(s, size * (0.5 + Math.random() * 1.1)))
  }

  // trades at the top of the book
  const count = Math.random() < 0.35 ? (Math.random() < 0.3 ? 2 : 1) : 0
  for (let k = 0; k < count; k++) {
    const side: Side = Math.random() < 0.5 ? 'buy' : 'sell'
    const t = side === 'buy' ? bestAskT : bestBidT
    const book = side === 'buy' ? s.asks : s.bids
    const level = book.get(t) ?? 0
    const size = sizeOf(s, Math.min(level, s.baseSize * Math.random() * 0.6))
    pushTrade(s, priceOf(s, t), size, side)
    setLevel(s, side === 'buy' ? 'sell' : 'buy', t, roundTo(level - size, s.market.sizeDecimals))
  }
}

const updateCandle = (s: Sim, price: number) => {
  const t = nowSec()
  if (t !== s.current.t) {
    s.candles.push(s.current)
    if (s.candles.length > HISTORY_SECONDS) s.candles.splice(0, s.candles.length - HISTORY_SECONDS)
    const o = s.current.c
    s.current = { t, o, h: Math.max(o, price), l: Math.min(o, price), c: price, v: 0 }
    return
  }
  s.current.c = price
  s.current.h = Math.max(s.current.h, price)
  s.current.l = Math.min(s.current.l, price)
}

/** Seconds before the simulation started, generated on first request: a random walk that ends where the live candles begin */
const ensureHistory = (s: Sim): Candle[] => {
  if (s.history) return s.history
  const first = s.candles[0] ?? s.current
  const history: Candle[] = []
  let close = first.o
  const perSecond = s.sigma * Math.sqrt(1000 / STEP_MS)
  for (let i = 1; i <= HISTORY_SECONDS; i++) {
    const open = close * Math.exp(-gauss() * perSecond)
    const wick = Math.abs(gauss()) * perSecond * 0.6
    history.push({
      t: first.t - i,
      o: open,
      c: close,
      h: Math.max(open, close) * (1 + wick),
      l: Math.min(open, close) * (1 - wick),
      v: s.baseSize * (1 + Math.random() * Math.random() * 12),
    })
    close = open
  }
  s.history = history.reverse()
  return s.history
}

// ---------------------------------------------------------------- socket

type Sub<C extends keyof Channels> = { handler: (msg: Channels[C]) => void; ready: boolean }
const subs = new Map<string, Set<Sub<any>>>()
const subKey = (channel: keyof Channels, key: string) => `${channel}:${key}`
const listeners = (channel: keyof Channels, key: string): Set<Sub<any>> | undefined => subs.get(subKey(channel, key))

let status: ConnectionStatus = 'connecting'
const statusListeners = new Set<(status: ConnectionStatus) => void>()
const setStatus = (next: ConnectionStatus) => {
  status = next
  statusListeners.forEach(l => l(next))
  if (next === 'open') subs.forEach((set, key) => set.forEach(sub => { if (key.startsWith('book:')) deliverSnapshot(key.slice(5), sub) }))
}

let delivered = 0
const deliver = <C extends keyof Channels>(sub: Sub<C>, msg: Channels[C]) => {
  if (status !== 'open' || !sub.ready) return
  delivered++
  sub.handler(msg)
}

const deliverSnapshot = (symbol: string, sub: Sub<'book'>) => {
  sub.ready = false
  setTimeout(() => {
    if (status !== 'open' || !listeners('book', symbol)?.has(sub)) return
    const s = sim(symbol)
    if (!s.bookLive) rebuildBook(s)
    const levels = (book: Map<number, number>): Level[] => [...book].map(([t, size]) => [priceOf(s, t), size] as const)
    sub.ready = true
    deliver(sub, { type: 'snapshot', seq: s.seq, bids: levels(s.bids), asks: levels(s.asks) })
  }, 60 + Math.random() * 140)
}

let chaos = false
let speed = 1

export const socket = {
  status: () => status,
  onStatus(listener: (status: ConnectionStatus) => void) {
    statusListeners.add(listener)
    listener(status)
    return () => { statusListeners.delete(listener) }
  },

  subscribe<C extends keyof Channels>(channel: C, key: string, handler: (msg: Channels[C]) => void): () => void {
    start()
    const sub: Sub<C> = { handler, ready: channel !== 'book' }
    const k = subKey(channel, key)
    let set = subs.get(k)
    if (!set) subs.set(k, set = new Set())
    set.add(sub)
    if (channel === 'book') deliverSnapshot(key, sub as Sub<'book'>)
    return () => {
      set.delete(sub)
      if (set.size === 0) subs.delete(k)
    }
  },
}

// ---------------------------------------------------------------- account

const balances = new Map<string, { free: number; locked: number }>([
  ['USD', { free: 50_000, locked: 0 }],
  ['BTC', { free: 0.5, locked: 0 }],
  ['ETH', { free: 4, locked: 0 }],
  ['SOL', { free: 60, locked: 0 }],
  ['XRP', { free: 5_000, locked: 0 }],
])
const orders = new Map<string, Order>()
let accountSeq = 1
let orderId = 1000
let fillId = 1

const balance = (asset: string) => {
  let b = balances.get(asset)
  if (!b) balances.set(asset, b = { free: 0, locked: 0 })
  return b
}

const clean = (x: number) => (Math.abs(x) < 1e-9 ? 0 : roundTo(x, 10))

type Unsequenced = AccountMessage extends infer M ? M extends AccountMessage ? Omit<M, 'seq'> : never : never

const emitAccount = (msg: Unsequenced) => {
  const full = { ...msg, seq: ++accountSeq } as AccountMessage
  listeners('account', '')?.forEach(sub => deliver(sub, full))
}

const emitBalances = (assets: string[]) =>
  emitAccount({
    type: 'balances',
    balances: assets.map(asset => ({ asset, free: balance(asset).free, locked: balance(asset).locked })),
  })

const lock = (asset: string, amount: number) => {
  const b = balance(asset)
  b.free = clean(b.free - amount)
  b.locked = clean(b.locked + amount)
}
const unlock = (asset: string, amount: number) => lock(asset, -amount)

const lockedFor = (o: Order, qty: number) => (o.side === 'buy' ? qty * (o.price ?? 0) * (1 + FEE_RATE) : qty)

const applyFill = (o: Order, qty: number, price: number, liquidity: Fill['liquidity']) => {
  const s = sim(o.symbol)
  const { base, quote } = s.market
  const notional = qty * price
  const fee = notional * FEE_RATE
  if (o.type === 'limit') unlock(o.side === 'buy' ? quote : base, lockedFor(o, qty))
  if (o.side === 'buy') {
    balance(quote).free = clean(balance(quote).free - notional - fee)
    balance(base).free = clean(balance(base).free + qty)
  } else {
    balance(base).free = clean(balance(base).free - qty)
    balance(quote).free = clean(balance(quote).free + notional - fee)
  }
  const filled = roundTo(o.filled + qty, s.market.sizeDecimals)
  o.avgPrice = (o.avgPrice * o.filled + price * qty) / filled
  o.filled = filled
  o.status = filled >= o.size ? 'filled' : 'partially_filled'
  o.version++
  emitAccount({
    type: 'fill',
    fill: { id: fillId++, orderId: o.id, symbol: o.symbol, side: o.side, price, size: qty, fee, liquidity, ts: Date.now() },
  })
  emitAccount({ type: 'order', order: { ...o } })
  emitBalances([base, quote])
}

/** Fills against the book as a taker, up to limitT (in ticks) when given; returns the filled size */
const takeLiquidity = (o: Order, limitT?: number) => {
  const s = sim(o.symbol)
  if (!s.bookLive) rebuildBook(s)
  const buy = o.side === 'buy'
  const book = buy ? s.asks : s.bids
  const ticks = [...book.keys()].sort((a, b) => (buy ? a - b : b - a))
  for (const t of ticks) {
    const remaining = roundTo(o.size - o.filled, s.market.sizeDecimals)
    if (remaining <= 0) break
    if (limitT !== undefined && (buy ? t > limitT : t < limitT)) break
    const level = book.get(t) ?? 0
    let qty = Math.min(level, remaining)
    const price = priceOf(s, t)
    if (buy && o.type === 'market') {
      // a market buy stops where the money runs out
      const affordable = Math.floor(balance(s.market.quote).free / (price * (1 + FEE_RATE)) / s.market.stepSize) * s.market.stepSize
      qty = Math.min(qty, roundTo(affordable, s.market.sizeDecimals))
      if (qty <= 0) break
    }
    pushTrade(s, price, qty, o.side)
    setLevel(s, buy ? 'sell' : 'buy', t, roundTo(level - qty, s.market.sizeDecimals))
    applyFill(o, qty, price, 'taker')
  }
}

const matchRestingOrders = (s: Sim) => {
  for (const o of orders.values()) {
    if (o.symbol !== s.market.symbol || o.type !== 'limit' || (o.status !== 'open' && o.status !== 'partially_filled')) continue
    const t = ticksOf(s, o.price ?? 0)
    const crossed = o.side === 'buy' ? s.bestAskT <= t : s.bestBidT >= t
    if (!crossed || Math.random() < 0.5) continue
    const remaining = roundTo(o.size - o.filled, s.market.sizeDecimals)
    const qty = Math.random() < 0.6 ? remaining : sizeOf(s, Math.min(remaining, remaining * (0.2 + Math.random() * 0.6)))
    pushTrade(s, o.price ?? 0, qty, o.side === 'buy' ? 'sell' : 'buy')
    applyFill(o, qty, o.price ?? 0, 'maker')
  }
}

const hasOpenOrders = (symbol: string) => {
  for (const o of orders.values()) if (o.symbol === symbol && (o.status === 'open' || o.status === 'partially_filled')) return true
  return false
}

// ---------------------------------------------------------------- REST

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const latency = (min: number, max: number) => min + Math.random() * (max - min)

const online = () => {
  if (status !== 'open') throw new Error('Network error: not connected')
}

const validateOrder = (req: PlaceOrderRequest): string | undefined => {
  const s = sims.get(req.symbol)
  if (!s) return 'Unknown market'
  const { market } = s
  if (!(req.size > 0) || !isMultipleOf(req.size, market.stepSize)) return `Size must be a multiple of ${market.stepSize}`
  const last = s.ticker.last
  if (req.type === 'limit') {
    const price = req.price ?? 0
    if (!(price > 0) || !isMultipleOf(price, market.tickSize)) return `Price must be a multiple of ${market.tickSize}`
    if (Math.abs(price / last - 1) > PRICE_BAND) return `Price is more than ${PRICE_BAND * 100}% away from the last price`
    if (price * req.size < market.minNotional) return `Order value is below the minimum of ${market.minNotional} ${market.quote}`
    const need = req.side === 'buy' ? price * req.size * (1 + FEE_RATE) : req.size
    const asset = req.side === 'buy' ? market.quote : market.base
    if (balance(asset).free + 1e-9 < need) return `Insufficient ${asset} balance`
  } else {
    if (last * req.size < market.minNotional) return `Order value is below the minimum of ${market.minNotional} ${market.quote}`
    if (req.side === 'sell' && balance(market.base).free + 1e-9 < req.size) return `Insufficient ${market.base} balance`
    if (req.side === 'buy' && balance(market.quote).free < last * req.size * 0.5) return `Insufficient ${market.quote} balance`
  }
  return undefined
}

export const api = {
  async getMarkets(): Promise<Market[]> {
    start()
    await wait(latency(80, 200))
    return [...sims.values()].map(s => s.market)
  },

  async getCandles(symbol: string, interval: number, limit: number): Promise<{ candles: Candle[]; lastTradeId: number }> {
    start()
    await wait(latency(150, 400))
    online()
    const s = sim(symbol)
    const series = [...ensureHistory(s), ...s.candles, { ...s.current }]
    const out: Candle[] = []
    for (const c of series) {
      const t = Math.floor(c.t / interval) * interval
      const last = out[out.length - 1]
      if (last && last.t === t) {
        last.h = Math.max(last.h, c.h)
        last.l = Math.min(last.l, c.l)
        last.c = c.c
        last.v += c.v
      } else {
        out.push({ ...c, t })
      }
    }
    return { candles: out.slice(-limit), lastTradeId: tradeId }
  },

  async getAccount(): Promise<AccountSnapshot> {
    start()
    await wait(latency(120, 300))
    online()
    const all = [...orders.values()]
    const open = all.filter(o => o.status === 'open' || o.status === 'partially_filled')
    const closed = all.filter(o => !open.includes(o)).slice(-50)
    return {
      seq: accountSeq,
      balances: [...balances].map(([asset, b]) => ({ asset, ...b })),
      orders: [...open, ...closed].map(o => ({ ...o })),
    }
  },

  /** Resolves with the order as it was when the engine accepted it: events about it can arrive before or after */
  async placeOrder(req: PlaceOrderRequest): Promise<Order> {
    const total = latency(120, 380)
    await wait(total * 0.5)
    online()
    if (Math.random() < 0.04) {
      await wait(total * 0.5)
      throw new Error('Rate limit exceeded, try again')
    }
    const error = validateOrder(req)
    if (error) {
      await wait(total * 0.5)
      throw new Error(error)
    }
    const s = sim(req.symbol)
    const o: Order = {
      id: `o${++orderId}`,
      clientId: req.clientId,
      symbol: req.symbol,
      side: req.side,
      type: req.type,
      price: req.type === 'limit' ? req.price ?? null : null,
      size: req.size,
      filled: 0,
      avgPrice: 0,
      status: 'open',
      createdAt: Date.now(),
      version: 1,
    }
    orders.set(o.id, o)
    if (o.type === 'limit') {
      lock(o.side === 'buy' ? s.market.quote : s.market.base, lockedFor(o, o.size))
      emitAccount({ type: 'order', order: { ...o } })
      emitBalances([s.market.base, s.market.quote])
      takeLiquidity(o, ticksOf(s, o.price ?? 0))
    } else {
      emitAccount({ type: 'order', order: { ...o } })
      takeLiquidity(o)
      if (o.status !== 'filled') {
        // immediate-or-cancel: what the book could not fill is cancelled
        o.status = 'cancelled'
        o.version++
        emitAccount({ type: 'order', order: { ...o } })
      }
    }
    const response = { ...o }
    await wait(total * 0.5)
    return response
  },

  async cancelOrder(id: string): Promise<void> {
    const total = latency(100, 260)
    await wait(total * 0.5)
    online()
    const o = orders.get(id)
    if (!o) throw new Error('Unknown order')
    if (o.status !== 'open' && o.status !== 'partially_filled') throw new Error(`Order is already ${o.status.replace('_', ' ')}`)
    const s = sim(o.symbol)
    unlock(o.side === 'buy' ? s.market.quote : s.market.base, lockedFor(o, roundTo(o.size - o.filled, s.market.sizeDecimals)))
    o.status = 'cancelled'
    o.version++
    emitAccount({ type: 'order', order: { ...o } })
    emitBalances([s.market.base, s.market.quote])
    await wait(total * 0.5)
  },
}

// ---------------------------------------------------------------- the clock

let started = false
let lastStats = { at: Date.now(), delivered: 0, messagesPerSecond: 0, stepMs: 0 }
let stepTime = 0

// Market time advances in 50 ms steps, `speed` steps per 50 ms of wall time. At 1x the feed is
// delivered every 50 ms; faster feeds are delivered every 16 ms, so the client sees a batch every frame.
let owed = 0
let lastTick = 0
let timer: ReturnType<typeof setInterval> | undefined
const schedule = () => {
  clearInterval(timer)
  lastTick = performance.now()
  timer = setInterval(step, speed > 1 ? 16 : STEP_MS)
}

const step = () => {
  const t0 = performance.now()
  owed += ((t0 - lastTick) / STEP_MS) * speed
  lastTick = t0
  const steps = Math.min(Math.floor(owed), speed * 4)
  owed = Math.min(owed - steps, speed)
  for (let n = 0; n < steps; n++) {
    for (const s of sims.values()) {
      s.mid *= Math.exp(gauss() * s.sigma)
      const symbol = s.market.symbol
      const active = listeners('book', symbol) || listeners('trades', symbol) || hasOpenOrders(symbol)
      if (active) {
        if (!s.bookLive) rebuildBook(s)
        stepBook(s)
        matchRestingOrders(s)
      } else {
        s.bookLive = false
        s.ticker.last = roundTo(s.mid, s.market.priceDecimals)
        s.ticker.high = Math.max(s.ticker.high, s.ticker.last)
        s.ticker.low = Math.min(s.ticker.low, s.ticker.last)
        s.tickerDirty = true
      }
      updateCandle(s, s.ticker.last)

      if (s.changedBids.size || s.changedAsks.size) {
        const prevSeq = s.seq
        s.seq++
        const book = listeners('book', symbol)
        // chaos mode loses one book message in a hundred: the client sees a gap in seq and has to resync
        if (book && !(chaos && Math.random() < 0.01)) {
          const level = (side: Map<number, number>) => (t: number): Level => [priceOf(s, t), side.get(t) ?? 0]
          const msg: BookMessage = {
            type: 'delta',
            seq: s.seq,
            prevSeq,
            bids: [...s.changedBids].map(level(s.bids)),
            asks: [...s.changedAsks].map(level(s.asks)),
          }
          book.forEach(sub => deliver(sub, msg))
        }
        s.changedBids.clear()
        s.changedAsks.clear()
      }
    }
  }
  for (const s of sims.values()) {
    if (!s.trades.length) continue
    const batch = s.trades
    s.trades = []
    listeners('trades', s.market.symbol)?.forEach(sub => deliver(sub, batch))
  }
  stepTime += performance.now() - t0
}

let tickerCycle = 0
const emitTickers = () => {
  tickerCycle++
  const batch: Ticker[] = []
  for (const s of sims.values()) {
    // the majors report every cycle, the small caps when they happen to trade
    const major = s.sigma < 1e-4
    if (!s.tickerDirty || (!major && Math.random() > 0.3 && tickerCycle > 1)) continue
    s.tickerDirty = false
    s.ticker = { ...s.ticker, ts: Date.now() }
    batch.push(s.ticker)
  }
  if (batch.length) listeners('tickers', '')?.forEach(sub => deliver(sub, batch))
}

function start() {
  if (started) return
  started = true
  schedule()
  setInterval(emitTickers, TICKER_MS)
  setInterval(() => {
    const now = Date.now()
    const seconds = (now - lastStats.at) / 1000
    lastStats = {
      at: now,
      delivered,
      messagesPerSecond: Math.round((delivered - lastStats.delivered) / seconds),
      stepMs: stepTime / seconds,
    }
    stepTime = 0
  }, 1000)
  setTimeout(() => setStatus('open'), 400)
}

// ---------------------------------------------------------------- controls for the demo

export const simControls = {
  getSpeed: () => speed,
  setSpeed(next: number) {
    speed = next
    if (started) schedule()
  },
  getChaos: () => chaos,
  setChaos(next: boolean) { chaos = next },
  dropConnection() {
    if (status !== 'open') return
    setStatus('reconnecting')
    setTimeout(() => setStatus('open'), 1500 + Math.random() * 1000)
  },
  stats: () => ({ messagesPerSecond: lastStats.messagesPerSecond, simMsPerSecond: lastStats.stepMs }),
}

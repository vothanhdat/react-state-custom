// Market data for one symbol: order book, grouped book, trades, candles.
// Each store owns its socket subscription; the socket client shares channels between them.

import { useEffect, useMemo, useState } from 'react'
import { createStore } from 'react-state-custom'
import { frameScheduler } from '../lib/frame'
import { decimalsOf, roundTo } from '../lib/num'
import { api, socket } from '../sim/exchange'
import type { Candle, Level, Trade } from '../sim/types'
import { useConnection, useMarket } from './app'

// ---------------------------------------------------------------- order book

export type BookStatus = 'loading' | 'live' | 'resyncing' | 'stale'

const sortLevels = (side: Map<number, number>, descending: boolean): Level[] =>
  [...side].sort((a, b) => (descending ? b[0] - a[0] : a[0] - b[0]))

const applyLevels = (side: Map<number, number>, levels: readonly Level[]) => {
  for (const [price, size] of levels) {
    if (size > 0) side.set(price, size)
    else side.delete(price)
  }
}

const useBookState = ({ symbol }: { symbol: string }) => {
  const { online } = useConnection()
  const [book, setBook] = useState<{ bids: Level[]; asks: Level[] }>()
  const [status, setStatus] = useState<'loading' | 'live' | 'resyncing'>('loading')
  // bumped when a sequence gap is detected: the effect subscribes again and gets a fresh snapshot
  const [epoch, setEpoch] = useState(0)
  const [resyncs, setResyncs] = useState(0)

  useEffect(() => {
    // the book is kept in plain maps and published once per frame
    const bids = new Map<number, number>()
    const asks = new Map<number, number>()
    let seq: number | undefined
    let broken = false
    const frame = frameScheduler(() => setBook({ bids: sortLevels(bids, true), asks: sortLevels(asks, false) }))

    const unsubscribe = socket.subscribe('book', symbol, msg => {
      if (broken) return
      if (msg.type === 'snapshot') {
        bids.clear()
        asks.clear()
        applyLevels(bids, msg.bids)
        applyLevels(asks, msg.asks)
        seq = msg.seq
        setStatus('live')
      } else {
        if (seq === undefined) return
        if (msg.prevSeq !== seq) {
          broken = true
          setStatus('resyncing')
          setResyncs(n => n + 1)
          setEpoch(e => e + 1)
          return
        }
        applyLevels(bids, msg.bids)
        applyLevels(asks, msg.asks)
        seq = msg.seq
      }
      frame.schedule()
    })
    return () => {
      unsubscribe()
      frame.dispose()
    }
  }, [symbol, epoch])

  const bestBid = book?.bids[0]?.[0]
  const bestAsk = book?.asks[0]?.[0]
  return {
    bids: book?.bids,
    asks: book?.asks,
    bestBid,
    bestAsk,
    spread: bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : undefined,
    mid: bestBid !== undefined && bestAsk !== undefined ? (bestBid + bestAsk) / 2 : undefined,
    status: (online ? status : 'stale') as BookStatus,
    resyncs,
  }
}

// kept two seconds after the last reader leaves, so flipping between two symbols does not resubscribe
export const { useStore: useBook, getStore: getBook } = createStore('book', useBookState, { timeToClean: 2000 })

// ---------------------------------------------------------------- grouped book for the ladder

export type BookRow = { price: number; size: number; total: number }

const groupLevels = (levels: readonly Level[] | undefined, grouping: number, side: 'bid' | 'ask', depth: number, sizeDecimals: number): BookRow[] => {
  const rows: BookRow[] = []
  if (!levels) return rows
  const decimals = decimalsOf(grouping)
  let total = 0
  for (const [price, size] of levels) {
    const steps = price / grouping
    const bucket = roundTo((side === 'bid' ? Math.floor(steps + 1e-9) : Math.ceil(steps - 1e-9)) * grouping, decimals)
    total += size
    const last = rows[rows.length - 1]
    if (last && last.price === bucket) {
      last.size = roundTo(last.size + size, sizeDecimals)
      last.total = roundTo(total, sizeDecimals)
      continue
    }
    if (rows.length === depth) break
    rows.push({ price: bucket, size, total: roundTo(total, sizeDecimals) })
  }
  return rows
}

const useBookViewState = ({ symbol, grouping, depth }: { symbol: string; grouping: number; depth: number }) => {
  const { bids, asks, bestBid, bestAsk, spread, mid, status } = useBook({ symbol })
  const sizeDecimals = useMarket(symbol)?.sizeDecimals ?? 8
  const view = useMemo(() => {
    const bidRows = groupLevels(bids, grouping, 'bid', depth, sizeDecimals)
    const askRows = groupLevels(asks, grouping, 'ask', depth, sizeDecimals)
    return { bidRows, askRows, maxTotal: Math.max(bidRows.at(-1)?.total ?? 0, askRows.at(-1)?.total ?? 0) }
  }, [bids, asks, grouping, depth, sizeDecimals])
  // the ladder reads everything from this store, so the rows and the spread always come from the same book
  return { ...view, bestBid, bestAsk, spread, mid, status }
}

export const { useStore: useBookView } = createStore('book-view', useBookViewState)

// ---------------------------------------------------------------- trades

const MAX_TRADES = 60

const useTradesState = ({ symbol }: { symbol: string }) => {
  const [trades, setTrades] = useState<Trade[]>([])

  useEffect(() => {
    let buffer: Trade[] = []
    const frame = frameScheduler(() => {
      const fresh = buffer.reverse()
      buffer = []
      setTrades(prev => [...fresh, ...prev].slice(0, MAX_TRADES))
    })
    const unsubscribe = socket.subscribe('trades', symbol, batch => {
      buffer.push(...batch)
      if (buffer.length > MAX_TRADES) buffer = buffer.slice(-MAX_TRADES)
      frame.schedule()
    })
    return () => {
      unsubscribe()
      frame.dispose()
    }
  }, [symbol])

  const last = trades[0]
  const previous = last && trades.find(t => t.price !== last.price)
  return {
    trades,
    lastPrice: last?.price,
    direction: last && previous ? (last.price > previous.price ? 'up' as const : 'down' as const) : undefined,
  }
}

export const { useStore: useTrades, getStore: getTrades } = createStore('trades', useTradesState, { timeToClean: 2000 })

// ---------------------------------------------------------------- candles

const mergeTrades = (candles: Candle[], trades: readonly Trade[], interval: number): Candle[] => {
  if (!trades.length) return candles
  const out = candles.slice()
  for (const trade of trades) {
    const t = Math.floor(trade.ts / 1000 / interval) * interval
    const last = out[out.length - 1]
    if (last && last.t === t) {
      out[out.length - 1] = { ...last, h: Math.max(last.h, trade.price), l: Math.min(last.l, trade.price), c: trade.price, v: last.v + trade.size }
    } else if (!last || t > last.t) {
      out.push({ t, o: trade.price, h: trade.price, l: trade.price, c: trade.price, v: trade.size })
    }
  }
  return out.length > 600 ? out.slice(-600) : out
}

const useCandlesState = ({ symbol, interval }: { symbol: string; interval: number }) => {
  const { online } = useConnection()
  const [candles, setCandles] = useState<Candle[]>()
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // after a reconnect the trades in between are lost: fetch the history again
    if (!online) return
    let cancelled = false
    let pending: Trade[] = []
    // undefined until the history has arrived; trades up to this id are already in it
    let lastTradeId: number | undefined

    const frame = frameScheduler(() => {
      const trades = pending
      pending = []
      setCandles(prev => (prev ? mergeTrades(prev, trades, interval) : prev))
    })
    const unsubscribe = socket.subscribe('trades', symbol, batch => {
      pending.push(...batch)
      if (lastTradeId !== undefined) frame.schedule()
    })

    setError(undefined)
    api.getCandles(symbol, interval, 400).then(
      res => {
        if (cancelled) return
        lastTradeId = res.lastTradeId
        const newer = pending.filter(t => t.id > res.lastTradeId)
        pending = []
        setCandles(mergeTrades(res.candles, newer, interval))
      },
      (e: Error) => { if (!cancelled) setError(e.message) },
    )
    return () => {
      cancelled = true
      unsubscribe()
      frame.dispose()
    }
  }, [symbol, interval, online, attempt])

  return { candles, error, loading: !candles && !error, retry: () => setAttempt(a => a + 1) }
}

export const { useStore: useCandles } = createStore('candles', useCandlesState, {
  initialState: { loading: true },
  timeToClean: 30_000,
})

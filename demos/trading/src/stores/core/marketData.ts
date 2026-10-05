// Core: live market data for one symbol. Each store owns its socket subscription; the socket client
// shares channels between them. Market data arrives in bursts of tens or hundreds of messages a
// second, and the screen changes once per frame: messages are kept in plain objects and published
// once per frame, with `scheduled(publish, frame())`.

import { useEffect, useState } from 'react'
import { createStore } from 'react-state-custom'
import { frame, scheduled } from 'react-state-custom/schedulers'
import { applyLevels, sortLevels } from '../../domain/book'
import { mergeTrades } from '../../domain/candles'
import { api, socket } from '../../sim/exchange'
import type { Candle, Level, Trade } from '../../sim/types'
import { useConnection } from './connection'

// ---------------------------------------------------------------- order book

export type BookStatus = 'loading' | 'live' | 'resyncing' | 'stale'

const useBookState = ({ symbol }: { symbol: string }) => {
  const { online } = useConnection()
  const [book, setBook] = useState<{ bids: Level[]; asks: Level[] }>()
  const [status, setStatus] = useState<'loading' | 'live' | 'resyncing'>('loading')
  // bumped when a sequence gap is detected: the effect subscribes again and gets a fresh snapshot
  const [epoch, setEpoch] = useState(0)
  const [resyncs, setResyncs] = useState(0)

  useEffect(() => {
    const bids = new Map<number, number>()
    const asks = new Map<number, number>()
    let seq: number | undefined
    let broken = false
    const publish = scheduled(() => setBook({ bids: sortLevels(bids, true), asks: sortLevels(asks, false) }), frame())

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
      publish()
    })
    return () => {
      unsubscribe()
      publish.cancel()
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
export const { useStore: useBook, storeRef: bookRef } = createStore('book', useBookState, { timeToClean: 2000 })

// ---------------------------------------------------------------- trades

const MAX_TRADES = 60

const useTradesState = ({ symbol }: { symbol: string }) => {
  const [trades, setTrades] = useState<Trade[]>([])

  useEffect(() => {
    let buffer: Trade[] = []
    const publish = scheduled(() => {
      const fresh = buffer.reverse()
      buffer = []
      setTrades(prev => [...fresh, ...prev].slice(0, MAX_TRADES))
    }, frame())
    const unsubscribe = socket.subscribe('trades', symbol, batch => {
      buffer.push(...batch)
      if (buffer.length > MAX_TRADES) buffer = buffer.slice(-MAX_TRADES)
      publish()
    })
    return () => {
      unsubscribe()
      publish.cancel()
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

export const { useStore: useTrades, storeRef: tradesRef } = createStore('trades', useTradesState, { timeToClean: 2000 })

// ---------------------------------------------------------------- candles

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

    const publish = scheduled(() => {
      const trades = pending
      pending = []
      setCandles(prev => (prev ? mergeTrades(prev, trades, interval) : prev))
    }, frame())
    const unsubscribe = socket.subscribe('trades', symbol, batch => {
      pending.push(...batch)
      if (lastTradeId !== undefined) publish()
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
      publish.cancel()
    }
  }, [symbol, interval, online, attempt])

  return { candles, error, loading: !candles && !error, retry: () => setAttempt(a => a + 1) }
}

export const { useStore: useCandles } = createStore('candles', useCandlesState, {
  timeToClean: 30_000,
})

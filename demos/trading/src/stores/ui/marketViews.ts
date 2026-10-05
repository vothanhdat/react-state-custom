// UI: what the market panels render. The ladder is a store (three panels' worth of inputs, read by
// one component that renders 24 rows, and the rows and the spread must come from one book). The
// others are hooks: each has one reader, so a store would only add a commit per update.
// Cadence is decided here: the ladder follows every frame of the book, the depth chart (a few
// hundred SVG points nobody reads digit by digit) ten times a second.

import { useMemo } from 'react'
import { createStore, shallowEqual, throttle } from 'react-state-custom'
import { cumulate, groupLevels } from '../../domain/book'
import { myOrderPrices, orderLines, sameLines } from '../../domain/orders'
import { decimalsOf } from '../../lib/num'
import { useAccount } from '../core/account'
import { useBook, useCandles, useTrades } from '../core/marketData'
import { useMarket } from '../core/markets'

/** A market's rules, for panels that lay out by tick and step */
export const useMarketInfo = (symbol: string) => useMarket(symbol)

// ---------------------------------------------------------------- ladder

const useLadderState = ({ symbol, grouping, depth }: { symbol: string; grouping: number; depth: number }) => {
  const sizeDecimals = useMarket(symbol)?.sizeDecimals ?? 8
  const { bids, asks, spread, mid, status, resyncs } = useBook({ symbol })
  const { lastPrice, direction } = useTrades({ symbol })
  const mine = useAccount(s => myOrderPrices(s.orders, symbol, grouping), shallowEqual)

  const rows = useMemo(() => {
    const bidRows = groupLevels(bids, grouping, 'bid', depth, sizeDecimals, mine)
    const askRows = groupLevels(asks, grouping, 'ask', depth, sizeDecimals, mine)
    return { bidRows, askRows, maxTotal: Math.max(bidRows.at(-1)?.total ?? 0, askRows.at(-1)?.total ?? 0) }
  }, [bids, asks, grouping, depth, sizeDecimals, mine])

  return {
    ...rows,
    spread,
    spreadBps: spread !== undefined && mid ? (spread / mid) * 10_000 : undefined,
    status,
    resyncs,
    lastPrice,
    direction,
    priceDecimals: decimalsOf(grouping),
    sizeDecimals,
  }
}

export const { useStore: useLadder } = createStore('ladder', useLadderState)

// ---------------------------------------------------------------- trade tape

export const useTradeTape = (symbol: string) => {
  const { trades } = useTrades({ symbol })
  const market = useMarket(symbol)
  return { trades, priceDecimals: market?.priceDecimals ?? 2, sizeDecimals: market?.sizeDecimals ?? 4 }
}

// ---------------------------------------------------------------- depth chart

/** Cumulative depth around the mid; `zoom` is the share of the book's price range to show */
export const useDepth = (symbol: string, zoom: number) => {
  const decimals = useMarket(symbol)?.priceDecimals ?? 2
  const { bids, asks, mid } = useBook({ symbol }, { schedule: throttle(100) })
  const view = useMemo(() => {
    if (!mid) return undefined
    const deepest = Math.max(mid - (bids?.at(-1)?.[0] ?? mid), (asks?.at(-1)?.[0] ?? mid) - mid)
    if (!deepest) return undefined
    const lo = mid - deepest * zoom
    const hi = mid + deepest * zoom
    const bidPoints = cumulate(bids, p => p >= lo)
    const askPoints = cumulate(asks, p => p <= hi)
    return { lo, hi, bidPoints, askPoints, max: Math.max(bidPoints.at(-1)?.[1] ?? 0, askPoints.at(-1)?.[1] ?? 0) || 1 }
  }, [bids, asks, mid, zoom])
  return { view, mid, decimals }
}

// ---------------------------------------------------------------- candle chart

export const useChart = (symbol: string, interval: number) => {
  const { candles, loading, error, retry } = useCandles({ symbol, interval })
  const decimals = useMarket(symbol)?.priceDecimals ?? 2
  const lines = useAccount(s => orderLines(s.orders, symbol), sameLines)
  return { candles, loading, error, retry, decimals, lines }
}

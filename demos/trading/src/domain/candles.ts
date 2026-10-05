import type { Candle, Trade } from '../sim/types'

const MAX_CANDLES = 600

/** Folds trades (oldest first) into candles of `interval` seconds; returns the same array when there is nothing to add */
export const mergeTrades = (candles: Candle[], trades: readonly Trade[], interval: number): Candle[] => {
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
  return out.length > MAX_CANDLES ? out.slice(-MAX_CANDLES) : out
}

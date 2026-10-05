// UI: the header's readouts and the simulator controls.

import { useConnection } from '../core/connection'
import { useFeed } from '../core/feed'
import { useTrades } from '../core/marketData'
import { useMarket, useTickers } from '../core/markets'

export const useSymbolSummary = (symbol: string) => {
  const market = useMarket(symbol)
  const ticker = useTickers()[symbol]
  return {
    base: market?.base ?? '',
    decimals: market?.priceDecimals ?? 2,
    change: ticker ? ticker.last / ticker.open - 1 : undefined,
    high: ticker?.high,
    low: ticker?.low,
    volume: ticker?.volume,
  }
}

/** The last trade, at trade speed: read it in a small component of its own */
export const useLastTrade = (symbol: string) => {
  const { lastPrice, direction } = useTrades({ symbol })
  return { lastPrice, direction }
}

export const useConnectionStatus = () => {
  const { status } = useConnection()
  return { status }
}

export const useFeedControls = () => {
  const { speed, chaos, setSpeed, setChaos } = useFeed()
  const { status, drop } = useConnection()
  return { speed, chaos, setSpeed, setChaos, canDrop: status === 'open', drop }
}

export const useFeedStats = () => {
  const { messagesPerSecond, simMsPerSecond } = useFeed()
  return { messagesPerSecond, simMsPerSecond }
}

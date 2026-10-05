export type Side = 'buy' | 'sell'
export type OrderType = 'limit' | 'market'

/** [price, size]; a size of 0 in a delta removes the level */
export type Level = readonly [price: number, size: number]

export type Market = {
  symbol: string
  base: string
  quote: string
  tickSize: number
  stepSize: number
  minNotional: number
  priceDecimals: number
  sizeDecimals: number
}

export type Ticker = {
  symbol: string
  last: number
  open: number
  high: number
  low: number
  volume: number
  ts: number
}

export type BookMessage =
  | { type: 'snapshot'; seq: number; bids: Level[]; asks: Level[] }
  | { type: 'delta'; seq: number; prevSeq: number; bids: Level[]; asks: Level[] }

export type Trade = { id: number; price: number; size: number; side: Side; ts: number }

/** t is the bucket start in seconds */
export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number }

export type OrderStatus = 'open' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected'

export type Order = {
  id: string
  clientId: string
  symbol: string
  side: Side
  type: OrderType
  price: number | null
  size: number
  filled: number
  avgPrice: number
  status: OrderStatus
  createdAt: number
  /** increases on every change, so a stale copy never overwrites a newer one */
  version: number
}

export type Balance = { asset: string; free: number; locked: number }

export type Fill = {
  id: number
  orderId: string
  symbol: string
  side: Side
  price: number
  size: number
  fee: number
  liquidity: 'maker' | 'taker'
  ts: number
}

/** Every account message carries the account sequence number: a gap means messages were lost. */
export type AccountMessage =
  | { type: 'order'; seq: number; order: Order }
  | { type: 'balances'; seq: number; balances: Balance[] }
  | { type: 'fill'; seq: number; fill: Fill }

export type AccountSnapshot = { seq: number; balances: Balance[]; orders: Order[] }

export type PlaceOrderRequest = {
  clientId: string
  symbol: string
  side: Side
  type: OrderType
  price?: number
  size: number
}

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting'

export type Channels = {
  tickers: Ticker[]
  book: BookMessage
  trades: Trade[]
  account: AccountMessage
}

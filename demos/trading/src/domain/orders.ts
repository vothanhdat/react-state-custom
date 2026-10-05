// Orders: lifecycle helpers, queries over a set of orders, and the rules an order must pass.
// Plain functions: no React, no stores.

import { fmt } from '../lib/format'
import { isMultipleOf, roundTo } from '../lib/num'
import type { Market, Order, OrderType, PlaceOrderRequest, Side } from '../sim/types'
import { bucketOf, type Estimate } from './book'

export type OrderDraft = Omit<PlaceOrderRequest, 'clientId'>
export type PendingOrder = PlaceOrderRequest & { createdAt: number }
export type PlaceResult = { ok: true; order: Order } | { ok: false; error: string }
export type CancelResult = { ok: true; id: string } | { ok: false; id: string; error: string }

export type Orders = Record<string, Order | undefined>

/** No orders: what a reader has before the account loads, one object so selections stay equal */
export const NO_ORDERS: Orders = Object.freeze({})

export const isOpen = (o: Order) => o.status === 'open' || o.status === 'partially_filled'

export const omit = <T>(record: Record<string, T>, key: string): Record<string, T> => {
  if (!(key in record)) return record
  const { [key]: _, ...rest } = record
  return rest
}

/** A stale copy (an older REST response, a replayed event) never overwrites a newer one */
export const upsert = (orders: Orders, order: Order): Orders => {
  const current = orders[order.id]
  return current && current.version >= order.version ? orders : { ...orders, [order.id]: order }
}

/** What the orders still in flight will lock once the engine accepts them, so a form does not spend it twice */
export const reservedByPending = (pending: Record<string, PendingOrder | undefined>, asset: string, feeRate: number) => {
  let reserved = 0
  for (const p of Object.values(pending)) {
    if (!p) continue
    const [base, quote] = p.symbol.split('-')
    if (p.side === 'buy' && p.type === 'limit' && quote === asset) reserved += (p.price ?? 0) * p.size * (1 + feeRate)
    if (p.side === 'sell' && base === asset) reserved += p.size
  }
  return roundTo(reserved, 10)
}

// ---------------------------------------------------------------- queries

const select = (orders: Orders, keep: (o: Order) => boolean) =>
  Object.values(orders).filter((o): o is Order => !!o && keep(o)).sort((a, b) => b.createdAt - a.createdAt)

/** Open orders, newest first */
export const openOrderIds = (orders: Orders, symbol?: string) =>
  select(orders, o => isOpen(o) && (!symbol || o.symbol === symbol)).map(o => o.id)

/** Closed orders, newest first */
export const closedOrderIds = (orders: Orders, symbol: string | undefined, limit: number) =>
  select(orders, o => !isOpen(o) && (!symbol || o.symbol === symbol)).slice(0, limit).map(o => o.id)

export type OrderLine = { id: string; side: Side; price: number; size: number }

/** Resting limit orders of one market, as lines on a chart */
export const orderLines = (orders: Orders, symbol: string): OrderLine[] =>
  select(orders, o => o.symbol === symbol && o.type === 'limit' && isOpen(o))
    .map(o => ({ id: o.id, side: o.side, price: o.price ?? 0, size: o.size - o.filled }))

export const sameLines = (a: OrderLine[], b: OrderLine[]) =>
  a.length === b.length && a.every((l, i) => l.id === b[i]?.id && l.price === b[i]?.price && l.size === b[i]?.size)

/** Ladder rows that hold one of the user's open orders, grouped like the ladder */
export const myOrderPrices = (orders: Orders, symbol: string, grouping: number) =>
  select(orders, o => o.symbol === symbol && o.price !== null && isOpen(o))
    .map(o => bucketOf(o.price ?? 0, grouping, o.side === 'buy' ? 'bid' : 'ask'))
    .sort((a, b) => a - b)

// ---------------------------------------------------------------- rules

export type OrderCheck = {
  market: Market
  type: OrderType
  side: Side
  priceText: string
  /** the text of the field that sets the size: the amount, or the total when the total drives it */
  sizeText: string
  sizeFromTotal: boolean
  price: number | undefined
  size: number | undefined
  notional: number | undefined
  /** a market order priced against the book */
  estimate: Estimate | undefined
  crossesBook: boolean
  outOfBand: boolean
  baseAvailable: number
  quoteAvailable: number
}

export type OrderProblems = {
  priceError?: string
  sizeError?: string
  totalError?: string
  balanceError?: string
  warning?: string
  valid: boolean
}

export const checkOrder = (c: OrderCheck): OrderProblems => {
  const { market } = c
  const limit = c.type === 'limit'
  let priceError: string | undefined
  let sizeError: string | undefined
  let totalError: string | undefined
  let balanceError: string | undefined
  let warning: string | undefined

  if (limit) {
    if (c.price === undefined) priceError = c.priceText.trim() ? 'Not a number' : 'Enter a price'
    else if (c.price <= 0) priceError = 'Must be above 0'
    else if (!isMultipleOf(c.price, market.tickSize)) priceError = `Use steps of ${market.tickSize}`
    else if (c.outOfBand) priceError = `More than ${market.priceBand * 100}% from the last price`
  }

  if (c.size === undefined) sizeError = c.sizeText.trim() ? 'Not a number' : 'Enter an amount'
  else if (c.size <= 0) sizeError = c.sizeFromTotal ? 'Total too small for one step' : 'Must be above 0'
  else if (!isMultipleOf(c.size, market.stepSize)) sizeError = `Use steps of ${market.stepSize}`
  else if (!limit && c.estimate && c.estimate.filled < c.size) sizeError = 'Not enough liquidity in the book'

  if (!priceError && !sizeError && c.notional !== undefined && c.notional < market.minNotional) {
    totalError = `Minimum order is ${market.minNotional} ${market.quote}`
  }

  if (c.size !== undefined && c.size > 0 && c.notional !== undefined) {
    const buy = c.side === 'buy'
    const need = buy ? c.notional * (1 + market.feeRate) : c.size
    const available = buy ? c.quoteAvailable : c.baseAvailable
    if (need > available + 1e-9) {
      balanceError = `Insufficient ${buy ? market.quote : market.base}: ${fmt(Math.max(0, available), buy ? 2 : market.sizeDecimals)} available`
    }
  }

  if (c.crossesBook) warning = `Fills now against the ${c.side === 'buy' ? 'asks' : 'bids'} as a taker`
  else if (c.estimate && !sizeError && c.estimate.slippage > 0.002) warning = `Estimated slippage ${(c.estimate.slippage * 100).toFixed(2)}%`

  return { priceError, sizeError, totalError, balanceError, warning, valid: !priceError && !sizeError && !totalError && !balanceError }
}

// The domain layer is plain functions: tested without React, a DOM or a store.
import { describe, expect, it } from 'vitest'
import { estimateFill, groupLevels } from '../src/domain/book'
import { mergeTrades } from '../src/domain/candles'
import { checkOrder, reservedByPending, upsert, type OrderCheck } from '../src/domain/orders'
import { valueHoldings } from '../src/domain/portfolio'
import type { Market, Order } from '../src/sim/types'

const market: Market = {
  symbol: 'BTC-USD', base: 'BTC', quote: 'USD', tickSize: 0.1, stepSize: 0.001, minNotional: 5,
  priceDecimals: 1, sizeDecimals: 3, feeRate: 0.001, priceBand: 0.1,
}

describe('book', () => {
  it('groups levels into rows with running totals, bids down and asks up', () => {
    const bids = groupLevels([[100.6, 1], [100.2, 2], [99.9, 1]], 1, 'bid', 5, 3, [100])
    expect(bids).toEqual([
      { price: 100, size: 3, total: 3, mine: true },
      { price: 99, size: 1, total: 4, mine: false },
    ])
    expect(groupLevels([[100.2, 1]], 1, 'ask', 5, 3)[0]?.price).toBe(101)
  })

  it('prices a market order by walking the levels', () => {
    expect(estimateFill([[101, 1], [102, 2]], 2)).toMatchObject({ filled: 2, avgPrice: 101.5, worstPrice: 102 })
    expect(estimateFill([[101, 1]], 3)?.filled).toBe(1)
  })
})

describe('orders', () => {
  const base: OrderCheck = {
    market, type: 'limit', side: 'buy', priceText: '100', sizeText: '1', sizeFromTotal: false,
    price: 100, size: 1, notional: 100, estimate: undefined, crossesBook: false, outOfBand: false,
    baseAvailable: 0, quoteAvailable: 1000,
  }

  it('accepts a valid order and names each broken rule', () => {
    expect(checkOrder(base)).toEqual({ valid: true })
    expect(checkOrder({ ...base, price: 100.05, priceText: '100.05' }).priceError).toBe('Use steps of 0.1')
    expect(checkOrder({ ...base, size: 0.01, sizeText: '0.01', notional: 1 }).totalError).toBe('Minimum order is 5 USD')
    expect(checkOrder({ ...base, size: 10, notional: 1000 }).balanceError).toBe('Insufficient USD: 1,000.00 available')
    expect(checkOrder({ ...base, crossesBook: true })).toMatchObject({ valid: true, warning: 'Fills now against the asks as a taker' })
  })

  it('keeps the newest copy of an order', () => {
    const v2 = { id: 'o1', version: 2 } as Order
    const orders = { o1: v2 }
    expect(upsert(orders, { id: 'o1', version: 1 } as Order)).toBe(orders)
  })

  it('reserves what orders in flight will lock', () => {
    const pending = { c1: { clientId: 'c1', symbol: 'BTC-USD', side: 'buy' as const, type: 'limit' as const, price: 100, size: 2, createdAt: 0 } }
    expect(reservedByPending(pending, 'USD', 0.001)).toBe(200.2)
    expect(reservedByPending(pending, 'BTC', 0.001)).toBe(0)
  })
})

it('merges trades into the last candle or opens a new one', () => {
  const candles = [{ t: 100, o: 1, h: 1, l: 1, c: 1, v: 1 }]
  const out = mergeTrades(candles, [
    { id: 1, price: 2, size: 1, side: 'buy', ts: 100_500 },
    { id: 2, price: 3, size: 1, side: 'buy', ts: 105_000 },
  ], 5)
  expect(out).toEqual([{ t: 100, o: 1, h: 2, l: 1, c: 2, v: 2 }, { t: 105, o: 3, h: 3, l: 3, c: 3, v: 1 }])
  expect(mergeTrades(candles, [], 5)).toBe(candles)
})

it('values holdings, and gives no equity while a price is missing', () => {
  const balances = { USD: { asset: 'USD', free: 100, locked: 0 }, BTC: { asset: 'BTC', free: 1, locked: 0 } }
  const ticker = { symbol: 'BTC-USD', last: 50, open: 40, high: 0, low: 0, volume: 0, ts: 0 }
  expect(valueHoldings(balances, () => ticker)).toMatchObject({ equity: 150, change24h: 150 / 140 - 1 })
  expect(valueHoldings(balances, () => undefined).equity).toBeUndefined()
})

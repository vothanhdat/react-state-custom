import { act, fireEvent, render, screen } from '@testing-library/react'
import { AutoRootCtx } from 'react-state-custom'
import { mockStore, storeHandle } from 'react-state-custom/testing'
import { describe, expect, it, vi } from 'vitest'
import { OrderTicket } from '../src/components/OrderForm'
import type { PlaceResult } from '../src/domain/orders'
import type { Market, Order } from '../src/sim/types'
import { useAccount } from '../src/stores/core/account'
import { useBook, useTrades } from '../src/stores/core/marketData'
import { useMarkets } from '../src/stores/core/markets'
import { useOrderForm } from '../src/stores/ui/orderForm'

const market: Market = {
  symbol: 'BTC-USD', base: 'BTC', quote: 'USD', tickSize: 0.1, stepSize: 0.001, minNotional: 5, priceDecimals: 1, sizeDecimals: 3,
  feeRate: 0.001, priceBand: 0.1,
}

// every store the ticket reads, except the form itself, is a mock: no simulator, no timers
const setup = (placeOrder = vi.fn(async (): Promise<PlaceResult> => ({ ok: true, order: {} as Order }))) => {
  mockStore(useMarkets, { markets: { 'BTC-USD': market }, symbols: ['BTC-USD'] })
  const account = mockStore(useAccount, {
    balances: { USD: { asset: 'USD', free: 1000, locked: 0 }, BTC: { asset: 'BTC', free: 0.01, locked: 0 } },
    orders: {}, pending: {}, cancelling: {}, fills: [], status: 'ready', placeOrder,
  })
  const book = mockStore(useBook, { bids: [[100, 1]], asks: [[101, 1], [102, 2]], bestBid: 100, bestAsk: 101, status: 'live' })
  mockStore(useTrades, { trades: [], lastPrice: 100.5 })
  render(<><AutoRootCtx /><OrderTicket /></>)
  const [price, amount, total] = screen.getAllByRole('textbox') as HTMLInputElement[]
  return { price: price!, amount: amount!, total: total!, placeOrder, account, book }
}

const type = (input: HTMLInputElement, value: string) => {
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}
const errors = () => [...document.querySelectorAll('.field-error, .alert')].map(e => e.textContent)

describe('order ticket', () => {
  it('starts at the last price and derives the total from the amount', () => {
    const { price, amount, total } = setup()
    expect(price.value).toBe('100.5')
    type(amount, '2')
    expect(total.value).toBe('201.00')
    expect(errors()).toEqual([])
  })

  it('derives the amount from a total, rounded down to the step', () => {
    const { amount, total } = setup()
    type(total, '100')
    expect(amount.value).toBe('0.995')
  })

  it('reports each rule on its own field', () => {
    const { price, amount } = setup()
    type(amount, 'abc')
    expect(errors()).toEqual(['Not a number'])
    type(amount, '0.0005')
    expect(errors()).toEqual(['Use steps of 0.001'])
    type(amount, '0.01')
    expect(errors()).toEqual(['Minimum order is 5 USD'])
    type(price, '200')
    expect(errors()).toContain('More than 10% from the last price')
    type(price, '100.55')
    expect(errors()).toContain('Use steps of 0.1')
  })

  it('checks the balance, fee included, and what in-flight orders will lock', () => {
    const { amount, price, account } = setup()
    type(price, '100')
    type(amount, '9.991') // 999.1 + 0.9991 fee > 1000
    expect(errors()).toEqual(['Insufficient USD: 1,000.00 available'])
    type(amount, '9.9')
    expect(errors()).toEqual([])
    // an order still in flight will lock 500 USD
    act(() => account.set({ pending: { c1: { clientId: 'c1', symbol: 'BTC-USD', side: 'buy', type: 'limit', price: 500, size: 0.999, createdAt: 0 } } }))
    expect(errors()).toEqual(['Insufficient USD: 500.00 available'])
  })

  it('warns when a limit price crosses the book, and follows the book without re-rendering on every tick', () => {
    const { price, book } = setup()
    type(price, '101')
    expect(errors()).toEqual(['Fills now against the asks as a taker'])
    act(() => book.set({ bestAsk: 101.5, asks: [[101.5, 1]] }))
    expect(errors()).toEqual([])
  })

  it('prices a market order by walking the book', () => {
    const { amount } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Market' }))
    type(amount, '2')
    expect((screen.getAllByRole('textbox')[0] as HTMLInputElement).value).toBe('≈ 101.5') // (101 + 102) / 2
    expect(errors()).toEqual(['Estimated slippage 0.50%'])
    type(amount, '5')
    expect(errors()).toEqual(['Not enough liquidity in the book'])
  })

  it('submits the parsed order and clears the amount once accepted', async () => {
    const { price, amount, placeOrder } = setup()
    type(price, '99')
    type(amount, '1')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Buy BTC' })) })
    expect(placeOrder).toHaveBeenCalledWith({ symbol: 'BTC-USD', side: 'buy', type: 'limit', price: 99, size: 1 })
    expect(amount.value).toBe('')
    expect(price.value).toBe('99')
  })

  it('shows a rejection and keeps the draft', async () => {
    const { price, amount } = setup(vi.fn(async (): Promise<PlaceResult> => ({ ok: false, error: 'Rate limit exceeded, try again' })))
    type(price, '99')
    type(amount, '1')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Buy BTC' })) })
    expect(errors()).toEqual(['Rejected: Rate limit exceeded, try again'])
    expect(amount.value).toBe('1')
  })

  it('does not submit an invalid order, and then shows every error', async () => {
    const { amount, placeOrder } = setup()
    expect(errors()).toEqual([])
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Buy BTC' })) })
    expect(placeOrder).not.toHaveBeenCalled()
    expect(errors()).toEqual(['Enter an amount'])
    expect(amount.getAttribute('aria-invalid')).toBe('true')
  })

  it('takes a price from the ladder through the store, from outside the form', () => {
    const { price } = setup()
    act(() => storeHandle(useOrderForm, { symbol: 'BTC-USD' }).get().pickPrice!(100, 'bid'))
    expect(price.value).toBe('100.0')
    expect(screen.getByRole('button', { name: 'Sell BTC' })).toBeTruthy()
  })
})

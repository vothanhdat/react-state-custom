// The order ticket, one per symbol so a half-typed order survives a trip to another market.
// Validation reads three other stores: market rules, balances (minus orders still in flight)
// and the live book. Selectors keep the live parts from re-running the form on every tick:
// the form re-renders when "does this price cross the book" flips, not when the book moves.

import { useEffect, useState } from 'react'
import { createStore, shallowEqual } from 'react-state-custom'
import { fmt } from '../lib/format'
import { floorToStep, isMultipleOf, parseNum } from '../lib/num'
import { FEE_RATE, PRICE_BAND } from '../sim/exchange'
import type { Level, OrderType, Side } from '../sim/types'
import { reservedByPending, useAccount } from './account'
import { useMarket, useToasts } from './app'
import { getBook, getTrades, useBook, useTrades } from './market'

export type Estimate = { filled: number; cost: number; avgPrice: number; worstPrice: number; slippage: number }

/** Walks the book to price a market order of `size` */
export const estimateFill = (levels: readonly Level[] | undefined, size: number): Estimate | undefined => {
  const best = levels?.[0]?.[0]
  if (!levels || best === undefined) return undefined
  let filled = 0
  let cost = 0
  let worstPrice = best
  for (const [price, available] of levels) {
    if (filled >= size) break
    const qty = Math.min(available, size - filled)
    filled += qty
    cost += qty * price
    worstPrice = price
  }
  const avgPrice = filled > 0 ? cost / filled : best
  return { filled, cost, avgPrice, worstPrice, slippage: Math.abs(avgPrice / best - 1) }
}

type Field = 'price' | 'size' | 'total'

const useOrderFormState = ({ symbol }: { symbol: string }) => {
  const market = useMarket(symbol)
  const [side, setSide] = useState<Side>('buy')
  const [type, setType] = useState<OrderType>('limit')
  const [priceText, setPriceText] = useState('')
  const [sizeText, setSizeText] = useState('')
  const [totalText, setTotalText] = useState('')
  // the size drives the total, or the total drives the size
  const [driver, setDriver] = useState<'size' | 'total'>('size')
  const [touched, setTouched] = useState<Partial<Record<Field, true>>>({})
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string>()

  const { placeOrder } = useAccount()
  const { push: toast } = useToasts()
  const base = market?.base ?? ''
  const quote = market?.quote ?? ''
  const accountReady = useAccount(undefined, s => s.status === 'ready')
  const baseAvailable = useAccount(undefined, s => (s.balances?.[base]?.free ?? 0) - reservedByPending(s.pending, base))
  const quoteAvailable = useAccount(undefined, s => (s.balances?.[quote]?.free ?? 0) - reservedByPending(s.pending, quote))

  const limit = type === 'limit'
  const price = limit ? parseNum(priceText) : undefined
  const total = parseNum(totalText)
  const size = limit && driver === 'total'
    ? (price && total !== undefined && market ? floorToStep(total / price, market.stepSize) : undefined)
    : parseNum(sizeText)

  // live inputs, each reduced to what validation needs
  const estimate = useBook({ symbol }, s => (!limit && size ? estimateFill(side === 'buy' ? s.asks : s.bids, size) : undefined), shallowEqual)
  const crossesBook = useBook({ symbol }, s =>
    limit && price !== undefined && (side === 'buy' ? s.bestAsk !== undefined && price >= s.bestAsk : s.bestBid !== undefined && price <= s.bestBid))
  const outOfBand = useTrades({ symbol }, s =>
    price !== undefined && s.lastPrice !== undefined && Math.abs(price / s.lastPrice - 1) > PRICE_BAND)
  const hasLastPrice = useTrades({ symbol }, s => s.lastPrice !== undefined)

  // start the ticket at the last price once there is one
  useEffect(() => {
    if (!hasLastPrice || !market) return
    setPriceText(text => text || fmtInput(getTrades({ symbol }).get().lastPrice, market.priceDecimals))
  }, [hasLastPrice, market, symbol])

  // ---- validation
  const notional = limit ? (price !== undefined && size !== undefined ? price * size : undefined) : estimate?.cost
  let priceError: string | undefined
  let sizeError: string | undefined
  let totalError: string | undefined
  let balanceError: string | undefined
  let warning: string | undefined

  if (market) {
    if (limit) {
      if (price === undefined) priceError = priceText.trim() ? 'Not a number' : 'Enter a price'
      else if (price <= 0) priceError = 'Must be above 0'
      else if (!isMultipleOf(price, market.tickSize)) priceError = `Use steps of ${market.tickSize}`
      else if (outOfBand) priceError = `More than ${PRICE_BAND * 100}% from the last price`
    }
    const sizeInput = limit && driver === 'total' ? totalText : sizeText
    if (size === undefined) sizeError = sizeInput.trim() ? 'Not a number' : 'Enter an amount'
    else if (size <= 0) sizeError = driver === 'total' ? 'Total too small for one step' : 'Must be above 0'
    else if (!isMultipleOf(size, market.stepSize)) sizeError = `Use steps of ${market.stepSize}`
    else if (!limit && estimate && estimate.filled < size) sizeError = 'Not enough liquidity in the book'

    if (!priceError && !sizeError && notional !== undefined && notional < market.minNotional) {
      totalError = `Minimum order is ${market.minNotional} ${quote}`
    }
    if (size !== undefined && size > 0 && notional !== undefined) {
      const need = side === 'buy' ? notional * (1 + FEE_RATE) : size
      const available = side === 'buy' ? quoteAvailable : baseAvailable
      if (need > available + 1e-9) {
        balanceError = `Insufficient ${side === 'buy' ? quote : base}: ${fmt(Math.max(0, available), side === 'buy' ? 2 : market.sizeDecimals)} available`
      }
    }
    if (crossesBook) warning = `Fills now against the ${side === 'buy' ? 'asks' : 'bids'} as a taker`
    else if (estimate && !sizeError && estimate.slippage > 0.002) warning = `Estimated slippage ${(estimate.slippage * 100).toFixed(2)}%`
  }

  const valid = !!market && !priceError && !sizeError && !totalError && !balanceError
  const show = (field: Field, error: string | undefined) => (attempted || touched[field] ? error : undefined)

  // ---- actions
  const edit = () => setServerError(undefined)

  const setPrice = (text: string) => { edit(); setPriceText(text) }
  const setSize = (text: string) => { edit(); setDriver('size'); setSizeText(text) }
  const setTotal = (text: string) => { edit(); setDriver('total'); setTotalText(text) }
  const touch = (field: Field) => setTouched(t => (t[field] ? t : { ...t, [field]: true }))

  /** From the ladder: a click on an ask buys at that price, a click on a bid sells */
  const pickPrice = (value: number, from: 'bid' | 'ask') => {
    if (!market) return
    edit()
    setType('limit')
    setSide(from === 'ask' ? 'buy' : 'sell')
    setPriceText(fmtInput(value, market.priceDecimals))
  }

  const fillLastPrice = () => {
    if (!market) return
    edit()
    setPriceText(fmtInput(getTrades({ symbol }).get().lastPrice, market.priceDecimals))
  }

  /** A share of what is available, at the entered price (limit) or the best price (market) */
  const setPercent = (share: number) => {
    if (!market) return
    edit()
    const book = getBook({ symbol }).get()
    const ref = price ?? (side === 'buy' ? book.bestAsk : book.bestBid) ?? getTrades({ symbol }).get().lastPrice
    if (!ref) return
    const amount = side === 'buy' ? (quoteAvailable * share) / (ref * (1 + FEE_RATE)) : baseAvailable * share
    setDriver('size')
    setSizeText(fmtInput(floorToStep(Math.max(0, amount), market.stepSize), market.sizeDecimals))
  }

  const submit = async () => {
    setAttempted(true)
    if (!valid || !market || size === undefined || submitting || !placeOrder) return
    setSubmitting(true)
    setServerError(undefined)
    const result = await placeOrder({ symbol, side, type, price: limit ? price : undefined, size })
    setSubmitting(false)
    if (result.ok) {
      setSizeText('')
      setTotalText('')
      setDriver('size')
      setTouched({})
      setAttempted(false)
      toast?.({ kind: 'info', title: `${side === 'buy' ? 'Buy' : 'Sell'} ${type} order accepted`, body: `${size} ${base}${limit ? ` @ ${price}` : ''}` })
    } else {
      setServerError(result.error)
    }
  }

  return {
    market,
    side,
    type,
    price: priceText,
    // the field that is not driving shows the computed value
    size: driver === 'size' || !limit ? sizeText : size !== undefined ? fmtInput(size, market?.sizeDecimals ?? 8) : '',
    total: driver === 'total' && limit ? totalText : notional !== undefined ? notional.toFixed(2) : '',
    driver,
    priceError: show('price', priceError),
    sizeError: show(driver === 'total' && limit ? 'total' : 'size', sizeError),
    totalError: attempted || touched.size || touched.total ? totalError : undefined,
    balanceError,
    warning,
    estimate,
    available: side === 'buy' ? quoteAvailable : baseAvailable,
    availableAsset: side === 'buy' ? quote : base,
    fee: notional !== undefined ? notional * FEE_RATE : undefined,
    canSubmit: valid && accountReady && !submitting,
    submitting,
    serverError,
    setSide: (next: Side) => { edit(); setSide(next) },
    setType: (next: OrderType) => { edit(); setType(next) },
    setPrice,
    setSize,
    setTotal,
    touch,
    pickPrice,
    fillLastPrice,
    setPercent,
    submit,
  }
}

const fmtInput = (value: number | undefined, decimals: number) => (value === undefined ? '' : value.toFixed(decimals))

// a draft stays for ten minutes after its ticket closes
export const { useStore: useOrderForm, getStore: getOrderForm } = createStore('order-form', useOrderFormState, {
  timeToClean: 10 * 60_000,
})

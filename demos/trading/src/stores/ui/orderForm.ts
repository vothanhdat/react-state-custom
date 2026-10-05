// UI: the order ticket, one per symbol so a half-typed order survives a trip to another market.
// The store holds the draft and gathers the live inputs; the rules themselves are checkOrder() in
// the domain layer. Selectors reduce each live input to what the rules need, so the ticket
// re-renders when "does this price cross the book" flips, not when the book moves.

import { useEffect, useState } from 'react'
import { createStore, shallowEqual } from 'react-state-custom'
import { estimateFill } from '../../domain/book'
import { checkOrder, reservedByPending } from '../../domain/orders'
import { floorToStep, parseNum } from '../../lib/num'
import type { OrderType, Side } from '../../sim/types'
import { useAccount } from '../core/account'
import { getBook, getTrades, useBook, useTrades } from '../core/marketData'
import { useMarket } from '../core/markets'
import { useToasts } from './toasts'

type Field = 'price' | 'size' | 'total'

const fmtInput = (value: number | undefined, decimals: number) => (value === undefined ? '' : value.toFixed(decimals))

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
  const feeRate = market?.feeRate ?? 0
  const accountReady = useAccount(undefined, s => s.status === 'ready')
  const baseAvailable = useAccount(undefined, s => (s.balances?.[base]?.free ?? 0) - reservedByPending(s.pending, base, feeRate))
  const quoteAvailable = useAccount(undefined, s => (s.balances?.[quote]?.free ?? 0) - reservedByPending(s.pending, quote, feeRate))

  const limit = type === 'limit'
  const sizeFromTotal = limit && driver === 'total'
  const price = limit ? parseNum(priceText) : undefined
  const total = parseNum(totalText)
  const size = sizeFromTotal
    ? (price && total !== undefined && market ? floorToStep(total / price, market.stepSize) : undefined)
    : parseNum(sizeText)

  // live inputs, each reduced to what the rules need
  const estimate = useBook({ symbol }, s => (!limit && size ? estimateFill(side === 'buy' ? s.asks : s.bids, size) : undefined), shallowEqual)
  const crossesBook = useBook({ symbol }, s =>
    limit && price !== undefined && (side === 'buy' ? s.bestAsk !== undefined && price >= s.bestAsk : s.bestBid !== undefined && price <= s.bestBid))
  const outOfBand = useTrades({ symbol }, s =>
    !!market && price !== undefined && s.lastPrice !== undefined && Math.abs(price / s.lastPrice - 1) > market.priceBand)
  const hasLastPrice = useTrades({ symbol }, s => s.lastPrice !== undefined)

  // start the ticket at the last price once there is one
  useEffect(() => {
    if (!hasLastPrice || !market) return
    setPriceText(text => text || fmtInput(getTrades({ symbol }).get().lastPrice, market.priceDecimals))
  }, [hasLastPrice, market, symbol])

  const notional = limit ? (price !== undefined && size !== undefined ? price * size : undefined) : estimate?.cost
  const check = market
    ? checkOrder({
        market, type, side, priceText, sizeText: sizeFromTotal ? totalText : sizeText, sizeFromTotal,
        price, size, notional, estimate, crossesBook, outOfBand, baseAvailable, quoteAvailable,
      })
    : undefined
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
    const amount = side === 'buy' ? (quoteAvailable * share) / (ref * (1 + feeRate)) : baseAvailable * share
    setDriver('size')
    setSizeText(fmtInput(floorToStep(Math.max(0, amount), market.stepSize), market.sizeDecimals))
  }

  const submit = async () => {
    setAttempted(true)
    if (!check?.valid || size === undefined || submitting || !placeOrder) return
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
    size: sizeFromTotal ? fmtInput(size, market?.sizeDecimals ?? 8) : sizeText,
    total: sizeFromTotal ? totalText : notional !== undefined ? notional.toFixed(2) : '',
    driver,
    priceError: show('price', check?.priceError),
    sizeError: show(sizeFromTotal ? 'total' : 'size', check?.sizeError),
    totalError: attempted || touched.size || touched.total ? check?.totalError : undefined,
    balanceError: check?.balanceError,
    warning: check?.warning,
    estimate,
    available: side === 'buy' ? quoteAvailable : baseAvailable,
    availableAsset: side === 'buy' ? quote : base,
    fee: notional !== undefined ? notional * feeRate : undefined,
    canSubmit: !!check?.valid && accountReady && !submitting,
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

// a draft stays for ten minutes after its ticket closes
export const { useStore: useOrderForm } = createStore('order-form', useOrderFormState, { timeToClean: 10 * 60_000 })

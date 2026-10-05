// The private side: balances, orders and fills from one authenticated stream, plus the actions
// that change them. Orders are reconciled from three sources that race each other: the
// optimistic entry, the REST response and the stream events.

import { useEffect, useEffectEvent, useState } from 'react'
import { createStore, shallowEqual } from 'react-state-custom'
import { roundTo } from '../lib/num'
import { api, FEE_RATE, socket } from '../sim/exchange'
import type { AccountMessage, Balance, Fill, Order, PlaceOrderRequest } from '../sim/types'
import { useConnection, useToasts } from './app'

export type OrderDraft = Omit<PlaceOrderRequest, 'clientId'>
export type PendingOrder = PlaceOrderRequest & { createdAt: number }
export type PlaceResult = { ok: true; order: Order } | { ok: false; error: string }

export const isOpen = (o: Order) => o.status === 'open' || o.status === 'partially_filled'

const omit = <T,>(record: Record<string, T>, key: string): Record<string, T> => {
  if (!(key in record)) return record
  const { [key]: _, ...rest } = record
  return rest
}

/** A stale copy (an older REST response, a replayed event) never overwrites a newer one */
const upsert = (orders: Record<string, Order | undefined>, order: Order) => {
  const current = orders[order.id]
  return current && current.version >= order.version ? orders : { ...orders, [order.id]: order }
}

const byAsset = (list: readonly Balance[]) => Object.fromEntries(list.map(b => [b.asset, b]))

const useAccountState = () => {
  const { online } = useConnection()
  const { push: toast } = useToasts()
  const [balances, setBalances] = useState<Record<string, Balance | undefined>>()
  const [orders, setOrders] = useState<Record<string, Order | undefined>>({})
  const [pending, setPending] = useState<Record<string, PendingOrder | undefined>>({})
  const [cancelling, setCancelling] = useState<Record<string, true | undefined>>({})
  const [fills, setFills] = useState<Fill[]>([])
  const [synced, setSynced] = useState(false)
  // bumped after a gap in the stream or a failed snapshot: subscribe and fetch again
  const [epoch, setEpoch] = useState(0)

  // `toast` is undefined until the toasts store has run; an effect event reads the latest one
  // without making the subscription below depend on it
  const notifyFill = useEffectEvent((fill: Fill) => {
    toast?.({
      kind: 'success',
      title: `${fill.side === 'buy' ? 'Bought' : 'Sold'} ${fill.size} ${fill.symbol.split('-')[0]}`,
      body: `at ${fill.price} · ${fill.liquidity}`,
    })
  })

  useEffect(() => {
    if (!online) return
    let seq: number | undefined // undefined until the snapshot has arrived
    let buffer: AccountMessage[] = []
    let cancelled = false
    setSynced(false)

    const apply = (msg: AccountMessage) => {
      seq = msg.seq
      if (msg.type === 'order') {
        setOrders(prev => upsert(prev, msg.order))
        setPending(prev => omit(prev, msg.order.clientId))
      } else if (msg.type === 'balances') {
        setBalances(prev => ({ ...prev, ...byAsset(msg.balances) }))
      } else {
        setFills(prev => [msg.fill, ...prev].slice(0, 100))
        notifyFill(msg.fill)
      }
    }
    const resync = () => {
      cancelled = true
      setEpoch(e => e + 1)
    }

    const unsubscribe = socket.subscribe('account', '', msg => {
      if (cancelled) return
      if (seq === undefined) buffer.push(msg)
      else if (msg.seq === seq + 1) apply(msg)
      else resync()
    })

    api.getAccount().then(
      snapshot => {
        if (cancelled) return
        seq = snapshot.seq
        setBalances(byAsset(snapshot.balances))
        setOrders(prev => {
          let next: Record<string, Order | undefined> = Object.fromEntries(snapshot.orders.map(o => [o.id, o]))
          // keep newer copies we already hold (a REST response that landed while the snapshot was in flight)
          for (const o of Object.values(prev)) if (o && next[o.id]) next = upsert(next, o)
          return next
        })
        // events that arrived while the snapshot was in flight: the ones it already contains are skipped
        for (const msg of buffer) {
          if (msg.seq <= snapshot.seq) continue
          if (msg.seq !== seq + 1) return resync()
          apply(msg)
        }
        buffer = []
        setSynced(true)
      },
      () => { if (!cancelled) setTimeout(resync, 1000) },
    )
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [online, epoch])

  const placeOrder = async (draft: OrderDraft): Promise<PlaceResult> => {
    const clientId = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    setPending(prev => ({ ...prev, [clientId]: { ...draft, clientId, createdAt: Date.now() } }))
    try {
      const order = await api.placeOrder({ ...draft, clientId })
      setOrders(prev => upsert(prev, order))
      return { ok: true, order }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    } finally {
      setPending(prev => omit(prev, clientId))
    }
  }

  const cancelOrder = async (id: string) => {
    setCancelling(prev => ({ ...prev, [id]: true }))
    try {
      await api.cancelOrder(id)
    } catch (e) {
      toast?.({ kind: 'error', title: 'Cancel failed', body: e instanceof Error ? e.message : String(e) })
    } finally {
      setCancelling(prev => omit(prev, id))
    }
  }

  const cancelAll = (symbol?: string) => {
    for (const o of Object.values(orders)) {
      if (o && isOpen(o) && !cancelling[o.id] && (!symbol || o.symbol === symbol)) void cancelOrder(o.id)
    }
  }

  return {
    balances,
    orders,
    pending,
    cancelling,
    fills,
    status: !online ? 'stale' as const : synced ? 'ready' as const : 'loading' as const,
    placeOrder,
    cancelOrder,
    cancelAll,
  }
}

export const { useStore: useAccount, getStore: getAccount } = createStore('account', useAccountState, {
  initialState: { orders: {}, pending: {}, cancelling: {}, fills: [], status: 'loading' },
  timeToClean: 10 * 60_000,
})

// ---------------------------------------------------------------- reads that several components share

/** Ids of the open orders, newest first, optionally for one symbol; a new array only when the set changes */
export const useOpenOrderIds = (symbol?: string) =>
  useAccount(undefined, s =>
    Object.values(s.orders)
      .filter((o): o is Order => !!o && isOpen(o) && (!symbol || o.symbol === symbol))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(o => o.id),
  shallowEqual)

/** What the orders still in flight will lock once the engine accepts them: the form must not spend it twice */
export const reservedByPending = (pending: Record<string, PendingOrder | undefined>, asset: string) => {
  let reserved = 0
  for (const p of Object.values(pending)) {
    if (!p) continue
    const [base, quote] = p.symbol.split('-')
    if (p.side === 'buy' && p.type === 'limit' && quote === asset) reserved += (p.price ?? 0) * p.size * (1 + FEE_RATE)
    if (p.side === 'sell' && base === asset) reserved += p.size
  }
  return roundTo(reserved, 10)
}

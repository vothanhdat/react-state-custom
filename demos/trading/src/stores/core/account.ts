// Core: the private side. Balances, orders and fills from one authenticated stream, plus the
// commands that change them. Orders are reconciled from three sources that race each other: the
// optimistic entry, the REST response and the stream events. It knows nothing about the UI:
// commands return their outcome, fills are published as events, and the UI decides what to show.

import { useEffect, useRef, useState } from 'react'
import { createStore } from 'react-state-custom'
import { isOpen, omit, upsert, type CancelResult, type OrderDraft, type Orders, type PendingOrder, type PlaceResult } from '../../domain/orders'
import { api, socket } from '../../sim/exchange'
import type { AccountMessage, Balance, Fill } from '../../sim/types'
import { useConnection } from './connection'

const byAsset = (list: readonly Balance[]) => Object.fromEntries(list.map(b => [b.asset, b]))
const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

const useAccountState = () => {
  const { online } = useConnection()
  const [balances, setBalances] = useState<Record<string, Balance | undefined>>()
  const [orders, setOrders] = useState<Orders>({})
  const [pending, setPending] = useState<Record<string, PendingOrder | undefined>>({})
  const [cancelling, setCancelling] = useState<Record<string, true | undefined>>({})
  const [fills, setFills] = useState<Fill[]>([])
  const [synced, setSynced] = useState(false)
  // bumped after a gap in the stream or a failed snapshot: subscribe and fetch again
  const [epoch, setEpoch] = useState(0)
  // fills are events: readers that react to each one (a toast, a sound) register here instead of
  // diffing `fills`. A ref, so listeners stay registered when the effect below runs again.
  const fillListeners = useRef(new Set<(fill: Fill) => void>())

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
        // after the sequence check: a fill the snapshot already holds, or a replay, never notifies
        for (const listener of fillListeners.current) {
          try { listener(msg.fill) } catch (e) { console.error(e) } // a broken listener must not stop the stream
        }
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
          let next: Orders = Object.fromEntries(snapshot.orders.map(o => [o.id, o]))
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
      return { ok: false, error: message(e) }
    } finally {
      setPending(prev => omit(prev, clientId))
    }
  }

  const cancelOrder = async (id: string): Promise<CancelResult> => {
    setCancelling(prev => ({ ...prev, [id]: true }))
    try {
      await api.cancelOrder(id)
      return { ok: true, id }
    } catch (e) {
      return { ok: false, id, error: message(e) }
    } finally {
      setCancelling(prev => omit(prev, id))
    }
  }

  const cancelAll = (symbol?: string): Promise<CancelResult[]> =>
    Promise.all(
      Object.values(orders)
        .filter(o => o && isOpen(o) && !cancelling[o.id] && (!symbol || o.symbol === symbol))
        .map(o => cancelOrder(o!.id)),
    )

  /** Calls `listener` once for each fill accepted from now on; returns the unsubscribe */
  const onFill = (listener: (fill: Fill) => void) => {
    fillListeners.current.add(listener)
    return () => { fillListeners.current.delete(listener) }
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
    onFill,
  }
}

export const { useStore: useAccount } = createStore('account', useAccountState, { timeToClean: 10 * 60_000 })

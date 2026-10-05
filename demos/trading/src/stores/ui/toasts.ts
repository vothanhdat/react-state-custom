// UI: notifications. The toasts store shows them; fill-toasts decides which account events become one.

import { useEffect, useState } from 'react'
import { createStore } from 'react-state-custom'
import { useAccount } from '../core/account'

export type Toast = { id: number; kind: 'info' | 'success' | 'error'; title: string; body?: string }
let toastId = 1

export const { useStore: useToasts } = createStore('toasts', () => {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = (id: number) => setToasts(list => list.filter(t => t.id !== id))
  const push = (toast: Omit<Toast, 'id'>) => {
    const id = toastId++
    setToasts(list => [...list.slice(-3), { ...toast, id }])
    setTimeout(() => dismiss(id), toast.kind === 'error' ? 6000 : 3500)
  }
  return { toasts, push, dismiss }
}, { timeToClean: 10 * 60_000 })

// Fill → toast. A store of its own: one instance however many components start it (one toast per
// fill), and the account stream neither waits for the toasts store nor stops when it fails.
export const { useStore: useFillToasts } = createStore('fill-toasts', () => {
  const { push } = useToasts()
  const { onFill } = useAccount()

  useEffect(() => {
    // both are what this effect is for: without them there is nothing to do yet
    if (!push || !onFill) return
    return onFill(fill => push({
      kind: 'success',
      title: `${fill.side === 'buy' ? 'Bought' : 'Sold'} ${fill.size} ${fill.symbol.split('-')[0]}`,
      body: `at ${fill.price} · ${fill.liquidity}`,
    }))
  }, [push, onFill])

  return {}
})

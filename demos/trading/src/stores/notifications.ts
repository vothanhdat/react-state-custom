// Fill → toast. A store of its own so the account stream neither waits for the toasts store nor
// stops when it fails, and one instance however many components start it (one toast per fill).

import { useEffect } from 'react'
import { createStore } from 'react-state-custom'
import { useAccount } from './account'
import { useToasts } from './app'

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

import { act, render } from '@testing-library/react'
import { AutoRootCtx } from 'react-state-custom'
import { storeHandle, waitForStore } from 'react-state-custom/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountMessage, AccountSnapshot, Order } from '../src/sim/types'
import { useAccount } from '../src/stores/account'

// a scripted exchange: the test decides when each response and each event arrives
const fake = vi.hoisted(() => {
  const handlers = new Set<(msg: unknown) => void>()
  const deferred = <T,>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>(r => { resolve = r })
    return { promise, resolve }
  }
  return {
    handlers,
    deferred,
    emit: (msg: unknown) => handlers.forEach(h => h(msg)),
    api: { getAccount: vi.fn(), placeOrder: vi.fn(), cancelOrder: vi.fn() },
  }
})

vi.mock('../src/sim/exchange', () => ({
  FEE_RATE: 0.001,
  PRICE_BAND: 0.1,
  api: fake.api,
  simControls: { dropConnection: () => {} },
  socket: {
    status: () => 'open',
    onStatus: (listener: (s: string) => void) => { listener('open'); return () => {} },
    subscribe: (_channel: string, _key: string, handler: (msg: unknown) => void) => {
      fake.handlers.add(handler)
      return () => fake.handlers.delete(handler)
    },
  },
}))

const order = (patch: Partial<Order>): Order => ({
  id: 'o1', clientId: 'c?', symbol: 'BTC-USD', side: 'buy', type: 'limit', price: 100, size: 1, filled: 0, avgPrice: 0,
  status: 'open', createdAt: 0, version: 1, ...patch,
})
const emit = (msg: AccountMessage) => act(() => fake.emit(msg))

const start = async () => {
  const snapshot = fake.deferred<AccountSnapshot>()
  fake.api.getAccount.mockReturnValueOnce(snapshot.promise)
  render(<AutoRootCtx />)
  const release = storeHandle(useAccount).retain()
  await waitForStore(useAccount, undefined, ['placeOrder'])
  return { snapshot, release }
}

describe('account store', () => {
  beforeEach(() => vi.clearAllMocks())

  it('applies the events that arrive while the snapshot is in flight, and only the ones it does not contain', async () => {
    const { snapshot, release } = await start()
    emit({ type: 'balances', seq: 9, balances: [{ asset: 'USD', free: 1, locked: 0 }] })   // older than the snapshot
    emit({ type: 'balances', seq: 11, balances: [{ asset: 'USD', free: 900, locked: 100 }] }) // newer
    await act(async () => snapshot.resolve({ seq: 10, balances: [{ asset: 'USD', free: 1000, locked: 0 }], orders: [] }))

    const state = await waitForStore(useAccount, undefined, s => s.status === 'ready')
    expect(state.balances?.USD).toEqual({ asset: 'USD', free: 900, locked: 100 })
    release()
  })

  it('keeps the newest copy of an order when the stream beats the REST response', async () => {
    const { snapshot, release } = await start()
    await act(async () => snapshot.resolve({ seq: 1, balances: [], orders: [] }))

    const response = fake.deferred<Order>()
    fake.api.placeOrder.mockReturnValueOnce(response.promise)
    let placed!: Promise<unknown>
    act(() => { placed = storeHandle(useAccount).get().placeOrder!({ symbol: 'BTC-USD', side: 'buy', type: 'limit', price: 100, size: 1 }) })
    const clientId = Object.keys(storeHandle(useAccount).get().pending)[0]!
    expect(clientId).toBeDefined()

    // the engine fills the order and says so on the stream, then the REST response (version 1) lands
    emit({ type: 'order', seq: 2, order: order({ clientId, status: 'filled', filled: 1, version: 2 }) })
    expect(storeHandle(useAccount).get().pending).toEqual({})
    await act(async () => { response.resolve(order({ clientId })); await placed })

    expect(storeHandle(useAccount).get().orders.o1?.status).toBe('filled')
    release()
  })

  it('fetches a new snapshot after a gap in the stream', async () => {
    const { snapshot, release } = await start()
    await act(async () => snapshot.resolve({ seq: 1, balances: [], orders: [] }))
    await waitForStore(useAccount, undefined, s => s.status === 'ready')

    const second = fake.deferred<AccountSnapshot>()
    fake.api.getAccount.mockReturnValueOnce(second.promise)
    emit({ type: 'balances', seq: 3, balances: [] }) // seq 2 was lost
    expect(fake.api.getAccount).toHaveBeenCalledTimes(2)
    expect(storeHandle(useAccount).get().status).toBe('loading')

    await act(async () => second.resolve({ seq: 3, balances: [{ asset: 'USD', free: 5, locked: 0 }], orders: [] }))
    expect(storeHandle(useAccount).get().balances?.USD?.free).toBe(5)
    release()
  })
})

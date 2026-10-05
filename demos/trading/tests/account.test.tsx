import { act, render, screen } from '@testing-library/react'
import { AutoRootCtx } from 'react-state-custom'
import { mockStore, storeHandle, waitForStore } from 'react-state-custom/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountMessage, AccountSnapshot, Fill, Order } from '../src/sim/types'
import { useAccount } from '../src/stores/core/account'
import { useOrderCommands } from '../src/stores/ui/accountViews'
import { useFillToasts, useToasts } from '../src/stores/ui/toasts'
import { PanelBoundary } from '../src/components/PanelBoundary'

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
    const clientId = Object.keys(storeHandle(useAccount).get().pending ?? {})[0]!
    expect(clientId).toBeDefined()

    // the engine fills the order and says so on the stream, then the REST response (version 1) lands
    emit({ type: 'order', seq: 2, order: order({ clientId, status: 'filled', filled: 1, version: 2 }) })
    expect(storeHandle(useAccount).get().pending).toEqual({})
    await act(async () => { response.resolve(order({ clientId })); await placed })

    expect(storeHandle(useAccount).get().orders?.o1?.status).toBe('filled')
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

const fill = (patch: Partial<Fill>): Fill => ({
  id: 1, orderId: 'o1', symbol: 'BTC-USD', side: 'buy', price: 100, size: 0.5, fee: 0.05, liquidity: 'maker', ts: 0, ...patch,
})

// two components start the notifier, as two screens with a toast area would
const Notifier = () => { useFillToasts(); return null }

describe('fill toasts', () => {
  beforeEach(() => vi.clearAllMocks())

  const startWithNotifiers = () => {
    const snapshot = fake.deferred<AccountSnapshot>()
    fake.api.getAccount.mockReturnValueOnce(snapshot.promise)
    render(<><AutoRootCtx /><Notifier /><Notifier /></>)
    return snapshot
  }

  it('toasts each accepted fill once, however many components start the notifier', async () => {
    const snapshot = startWithNotifiers()
    await waitForStore(useAccount, undefined, ['onFill'])
    emit({ type: 'fill', seq: 5, fill: fill({ id: 1 }) })            // the snapshot already holds it
    emit({ type: 'fill', seq: 6, fill: fill({ id: 2, size: 0.25 }) }) // newer than the snapshot
    await act(async () => snapshot.resolve({ seq: 5, balances: [], orders: [] }))

    expect(storeHandle(useToasts).get().toasts?.map(t => t.title)).toEqual(['Bought 0.25 BTC'])
    emit({ type: 'fill', seq: 7, fill: fill({ id: 3, side: 'sell', size: 0.1 }) })
    expect(storeHandle(useToasts).get().toasts?.map(t => t.title)).toEqual(['Bought 0.25 BTC', 'Sold 0.1 BTC'])
  })

  it('keeps the account running when the toasts store fails, and shows the error where it is read', async () => {
    mockStore(useToasts, () => { throw new Error('toasts crashed') })
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    const snapshot = fake.deferred<AccountSnapshot>()
    fake.api.getAccount.mockReturnValueOnce(snapshot.promise)
    render(<><AutoRootCtx /><PanelBoundary name="Notifications" className="toasts"><Notifier /><Notifier /></PanelBoundary></>)
    await act(async () => snapshot.resolve({ seq: 1, balances: [{ asset: 'USD', free: 10, locked: 0 }], orders: [] }))
    emit({ type: 'fill', seq: 2, fill: fill({}) })

    const state = await waitForStore(useAccount, undefined, s => s.status === 'ready')
    expect(state.fills).toHaveLength(1)
    expect(state.balances?.USD?.free).toBe(10)
    // fill-toasts reads toasts, so it failed with its error, and so did the component reading it
    expect(screen.getByRole('alert').textContent).toContain('toasts crashed')
    quiet.mockRestore()
  })
})

describe('cancelling', () => {
  beforeEach(() => vi.clearAllMocks())

  // core returns the outcome; the UI layer decides that a failure is a toast
  const CancelButton = ({ id }: { id: string }) => {
    const { cancel } = useOrderCommands()
    return <button onClick={() => void cancel(id)}>cancel {id}</button>
  }

  it('returns the outcome from the account store and shows a failure as a toast in the UI layer', async () => {
    const snapshot = fake.deferred<AccountSnapshot>()
    fake.api.getAccount.mockReturnValueOnce(snapshot.promise)
    render(<><AutoRootCtx /><CancelButton id="o1" /></>)
    const release = storeHandle(useAccount).retain()
    await act(async () => snapshot.resolve({ seq: 1, balances: [], orders: [order({})] }))

    fake.api.cancelOrder.mockRejectedValueOnce(new Error('Order is already filled'))
    let result: unknown
    await act(async () => { result = await storeHandle(useAccount).get().cancelOrder!('o1') })
    expect(result).toEqual({ ok: false, id: 'o1', error: 'Order is already filled' })
    expect(storeHandle(useToasts).get().toasts).toEqual([]) // the account store showed nothing

    fake.api.cancelOrder.mockRejectedValueOnce(new Error('Order is already filled'))
    await act(async () => { screen.getByRole('button', { name: 'cancel o1' }).click() })
    expect(storeHandle(useToasts).get().toasts?.map(t => [t.title, t.body])).toEqual([['Cancel failed', 'Order is already filled']])
    release()
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { createStore, AutoRootCtx, StateScopeProvider } from '../src/state-utils/createAutoCtx'

const tick = (ms = 50) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

// a failing store logs through StoreErrorBoundary (and React); keep the output quiet
const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => { })
afterEach(() => vi.restoreAllMocks())

describe('useStoreStatus', () => {
  it('reports a store that fails on its first render, where useStore would show initialState for good', async () => {
    quiet()
    const { useStore, useStoreStatus } = createStore('status-first-render', ({ id }: { id: string }): { user: string, isLoading: boolean } => {
      throw new Error(`no user ${id}`)
    }, { initialState: { user: '', isLoading: true } })
    const Profile = () => {
      const { isLoading } = useStore({ id: '1' })
      const { ready, failed, error } = useStoreStatus({ id: '1' })
      if (failed) return <b data-testid="v">failed: {(error as Error).message}, ready: {String(ready)}</b>
      return <b data-testid="v">{isLoading ? 'spinner' : 'ok'}</b>
    }
    const { getByTestId } = render(<><AutoRootCtx /><Profile /></>)
    await tick()
    expect(getByTestId('v').textContent).toBe('failed: no user 1, ready: false')
  })

  it('goes from ready to failed when the store throws later', async () => {
    quiet()
    let crash = () => { }
    const { useStoreStatus } = createStore('status-later', () => {
      const [boom, setBoom] = useState(false)
      crash = () => setBoom(true)
      useEffect(() => { if (boom) throw new Error('bug in effect') }, [boom])
      return { boom }
    })
    const seen: string[] = []
    const Status = () => {
      const { ready, failed } = useStoreStatus()
      seen.push(`${ready}/${failed}`)
      return null
    }
    render(<><AutoRootCtx /><Status /></>)
    await tick()
    expect(seen[seen.length - 1]).toBe('true/false')
    act(() => crash())
    await tick()
    expect(seen[seen.length - 1]).toBe('true/true')
  })

  it('re-renders on status changes only, not on value changes', async () => {
    let increment = () => { }
    const { useStoreStatus } = createStore('status-quiet', () => {
      const [n, setN] = useState(0)
      increment = () => setN(x => x + 1)
      return { n }
    })
    let renders = 0
    const Status = () => { useStoreStatus(); renders++; return null }
    render(<><AutoRootCtx /><Status /></>)
    await tick()
    const before = renders
    act(() => { increment(); increment() })
    await tick()
    expect(renders).toBe(before)
  })

  it('works in a StateScopeProvider, where getStore cannot reach', async () => {
    quiet()
    const { useStoreStatus } = createStore('status-scoped', (): { v: number } => { throw new Error('scoped') })
    const Status = () => <b data-testid="v">{String(useStoreStatus().failed)}</b>
    const { getByTestId } = render(<StateScopeProvider><Status /></StateScopeProvider>)
    await tick()
    expect(getByTestId('v').textContent).toBe('true')
  })

  it('is no longer failed once the instance has been torn down and started again', async () => {
    quiet()
    let fail = true
    const { useStoreStatus } = createStore('status-recover', () => {
      if (fail) throw new Error('first instance')
      return { v: 1 }
    })
    const Status = () => <b data-testid="v">{String(useStoreStatus().failed)}</b>
    const { getByTestId, rerender } = render(<><AutoRootCtx /><Status /></>)
    await tick()
    expect(getByTestId('v').textContent).toBe('true')

    rerender(<><AutoRootCtx /></>) // the last consumer leaves: the failed instance is torn down
    await tick()
    fail = false
    rerender(<><AutoRootCtx /><Status /></>)
    await tick()
    expect(getByTestId('v').textContent).toBe('false')
  })

  it('lets a store that reads another one publish its failure', async () => {
    quiet()
    const source = createStore('status-source', (): { price: number } => { throw new Error('feed down') })
    const { useStore: useView } = createStore('status-view', () => {
      const { price } = source.useStore()
      const { failed } = source.useStoreStatus()
      return { label: failed ? 'feed unavailable' : price === undefined ? 'loading' : `$${price}` }
    })
    const View = () => <b data-testid="v">{useView().label}</b>
    const { getByTestId } = render(<><AutoRootCtx /><View /></>)
    await tick()
    expect(getByTestId('v').textContent).toBe('feed unavailable')
  })
})

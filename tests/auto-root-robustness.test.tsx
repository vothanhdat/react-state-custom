import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, renderHook, act } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { createStore, AutoRootCtx, StoreErrorBoundary } from '../src/state-utils/createAutoCtx'
import { getContext, useDataSourceMultiple, type Context } from '../src/state-utils/ctx'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

afterEach(() => vi.restoreAllMocks())

describe('AutoRootCtx robustness', () => {
  it('does not re-run other store hooks when an unrelated consumer mounts', async () => {
    let runsA = 0
    const { useStore: useA } = createStore('memo-a', (_: {}) => { runsA++; return { a: 1 } })
    const { useStore: useB } = createStore('memo-b', (_: {}) => ({ b: 2 }))
    const A = () => <span>{useA({}).a}</span>
    const B = () => <span>{useB({}).b}</span>

    const Host = () => {
      const [showB, setShowB] = useState(false)
      return <>
        <AutoRootCtx />
        <A />
        {showB && <B />}
        <button data-testid="toggle" onClick={() => setShowB(s => !s)} />
      </>
    }
    const { getByTestId } = render(<Host />)
    await tick()
    const before = runsA
    act(() => getByTestId('toggle').click()); await tick()
    act(() => getByTestId('toggle').click()); await tick()
    expect(runsA).toBe(before)
  })

  it('isolates a throwing store with the default error boundary', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { useStore: useBad } = createStore('bad-store', (_: {}) => { throw new Error('boom') })
    const { useStore: useGood } = createStore('good-store', (_: {}) => ({ ok: 'yes' }))
    const Bad = () => <span>{String(useBad({}).anything)}</span>
    const Good = () => <span data-testid="good">{useGood({}).ok}</span>

    const { getByTestId } = render(<><AutoRootCtx /><Bad /><Good /></>)
    await tick()
    expect(getByTestId('good').textContent).toBe('yes')
    expect(err).toHaveBeenCalledWith(expect.stringContaining('store hook threw'), expect.any(Error), expect.anything())
    expect(AutoRootCtx).toBeDefined()
    expect(StoreErrorBoundary).toBeDefined()
  })

  it('publishes undefined and removes keys the store hook stops returning', () => {
    const ctx = getContext('removed-keys') as Context<{ a?: number, b?: number }>
    const { rerender } = renderHook(
      ({ withB }: { withB: boolean }) => useDataSourceMultiple(ctx, ...(withB ? [['a', 1], ['b', 2]] : [['a', 1]]) as any),
      { initialProps: { withB: true } }
    )
    expect(ctx.data).toEqual({ a: 1, b: 2 })
    const seen: unknown[] = []
    ctx.subscribe('b', v => seen.push(v))
    rerender({ withB: false })
    expect(seen).toEqual([2, undefined])
    expect('b' in ctx.data).toBe(false)
    expect(ctx.data).toEqual({ a: 1 })
  })

  it('publishes before paint (layout effect) so a consumer in the same commit reads the value', () => {
    const ctx = getContext('layout-publish') as Context<{ v: number }>
    const seenInEffect: unknown[] = []
    const Producer = () => { useDataSourceMultiple(ctx, ['v', 42]); return null }
    const Observer = () => {
      // a passive effect runs after all layout effects; the value must already be there
      useEffect(() => { seenInEffect.push(ctx.data.v) }, [])
      return null
    }
    render(<><Producer /><Observer /></>)
    expect(seenInEffect).toEqual([42])
  })
})

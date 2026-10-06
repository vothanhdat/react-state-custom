import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { Component, useState, type ReactNode } from 'react'
import { createStore, AutoRootCtx } from '../src'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

afterEach(() => vi.restoreAllMocks())

class Catch extends Component<{ children?: ReactNode, onError: (error: unknown) => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { this.props.onError(error) }
  render() { return this.state.failed ? null : this.props.children }
}

/**
 * A hot update re-runs the store's module, so createStore runs again with the same name and a new
 * hook, and the importing components re-render with it: their effects re-run and hand the new hook
 * to AutoRootCtx, which runs it in place of the old one. Two createStore calls with one name and a
 * swap of the consumer stand for that here.
 */
describe('a store hook replaced by a hot update', () => {
  it('keeps its state when the hooks it calls are unchanged', async () => {
    const v1 = createStore('hot-same', () => {
      const [count, setCount] = useState(1)
      return { count, setCount, label: 'v1' }
    })
    const v2 = createStore('hot-same', () => {
      const [count, setCount] = useState(1)
      return { count, setCount, label: 'v2' }
    })
    const View1 = () => { const { count, label } = v1.useStore(); return <span data-testid="v">{`${count} ${label}`}</span> }
    const View2 = () => { const { count, label } = v2.useStore(); return <span data-testid="v">{`${count} ${label}`}</span> }

    const { getByTestId, rerender } = render(<><AutoRootCtx /><View1 /></>)
    await tick()
    act(() => v1.storeRef().get().setCount!(5))
    await tick()
    expect(getByTestId('v').textContent).toBe('5 v1')

    rerender(<><AutoRootCtx /><View2 /></>)
    await tick()
    expect(getByTestId('v').textContent).toBe('5 v2')
  })

  it('restarts instead of being disabled when the hooks it calls changed', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const v1 = createStore('hot-changed', () => {
      const [count, setCount] = useState(1)
      return { count, setCount }
    })
    // one more hook, so the old hook state no longer fits
    const v2 = createStore('hot-changed', () => {
      const [count, setCount] = useState(1)
      const [label] = useState('v2')
      return { count, setCount, label }
    })
    const View1 = () => { const { count } = v1.useStore(); return <span data-testid="v">{String(count)}</span> }
    const View2 = () => { const { count, label } = v2.useStore(); return <span data-testid="v">{`${count} ${label}`}</span> }

    const { getByTestId, rerender } = render(<><AutoRootCtx /><View1 /></>)
    await tick()
    act(() => v1.storeRef().get().setCount!(5))
    await tick()

    rerender(<><AutoRootCtx /><View2 /></>)
    await tick()
    // a fresh instance of the new hook, like a component remounted by Fast Refresh
    expect(getByTestId('v').textContent).toBe('1 v2')
    expect(v2.storeRef().error).toBeUndefined()

    // and it runs: updates still reach the consumer
    act(() => v2.storeRef().get().setCount!(6))
    await tick()
    expect(getByTestId('v').textContent).toBe('6 v2')
    expect(errors.mock.calls.flat().join('\n')).not.toMatch(/has been disabled/)
  })

  it('restarts without the keys only the old hook returned', async () => {
    const v1 = createStore('hot-keys', () => {
      const [count] = useState(1)
      return { count, old: 'from v1' }
    })
    const v2 = createStore('hot-keys', () => {
      const [count] = useState(1)
      const [label] = useState('v2')
      return { count, label }
    })
    const View1 = () => { const { count } = v1.useStore(); return <span data-testid="v">{String(count)}</span> }
    const View2 = () => { const s = v2.useStore(); return <span data-testid="v">{Object.keys(s).sort().join(',')}</span> }
    const { getByTestId, rerender } = render(<><AutoRootCtx /><View1 /></>)
    await tick()
    rerender(<><AutoRootCtx /><View2 /></>)
    await tick()
    expect(getByTestId('v').textContent).toBe('count,label')
  })

  it('is still disabled when the new hook throws on its own, and its reader gets the error', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const v1 = createStore('hot-throws', () => ({ ok: true }))
    const broken = new Error('broken edit')
    const v2 = createStore('hot-throws', (): { ok: boolean } => {
      useState(0)
      throw broken
    })
    const View1 = () => { const { ok } = v1.useStore(); return <span data-testid="v">{String(ok)}</span> }
    const View2 = () => { const { ok } = v2.useStore(); return <span data-testid="v">{String(ok)}</span> }

    const { getByTestId, rerender } = render(<><AutoRootCtx /><View1 /></>)
    await tick()
    expect(getByTestId('v').textContent).toBe('true')

    const caught: unknown[] = []
    rerender(<><AutoRootCtx /><Catch onError={e => caught.push(e)}><View2 /></Catch></>)
    await tick()
    expect(caught).toEqual([broken])
    // restarted once, then disabled
    expect(errors.mock.calls.filter(call => String(call[0]).includes('store hook threw'))).toHaveLength(1)
  })
})

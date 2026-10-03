import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import React, { Component, Suspense, useEffect, useState } from 'react'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

afterEach(async () => {
  vi.restoreAllMocks()
  await act(() => new Promise(resolve => setTimeout(resolve, 150)))
})

class Catch extends Component<{ children: React.ReactNode }, { error?: unknown }> {
  state: { error?: unknown } = {}
  static getDerivedStateFromError(error: unknown) { return { error } }
  render() {
    return this.state.error !== undefined
      ? <b data-testid="caught">{String((this.state.error as Error).message)}</b>
      : this.props.children
  }
}

describe('a store hook that throws', () => {
  it('reaches a useStoreSuspense consumer when it throws before its first result', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => { })
    const { useStoreSuspense, getStore } = createStore('err-first', (): { v: number } => { throw new Error('boom') })
    const View = () => { const { v } = useStoreSuspense(); return <span>{v}</span> }
    const { queryByTestId } = render(
      <><AutoRootCtx /><Catch><Suspense fallback={<i data-testid="fb" />}><View /></Suspense></Catch></>
    )
    await tick(50)
    expect(queryByTestId('fb')).toBeNull()
    expect(queryByTestId('caught')?.textContent).toBe('boom')
    expect((getStore().error as Error).message).toBe('boom')
    // the retain taken while suspended is released a second after the consumer gave up
    await tick(1100)
    expect(getStore().error).toBeUndefined()
  })

  it('reaches a useStoreSuspense consumer when it throws after it was ready', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => { })
    let crash: () => void = () => { }
    const { useStoreSuspense } = createStore('err-later', () => {
      const [broken, setBroken] = useState(false)
      crash = () => setBroken(true)
      if (broken) throw new Error('later')
      return { v: 1 }
    })
    const View = () => { const { v } = useStoreSuspense(); return <span data-testid="v">{v}</span> }
    const { queryByTestId } = render(
      <><AutoRootCtx /><Catch><Suspense fallback={<i />}><View /></Suspense></Catch></>
    )
    await tick(50)
    expect(queryByTestId('v')?.textContent).toBe('1')
    act(() => crash())
    await tick(50)
    expect(queryByTestId('caught')?.textContent).toBe('later')
  })

  it('still reaches the Wrapper passed to AutoRootCtx, and getStore().error reports it while the instance lives', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => { })
    const reported: unknown[] = []
    class Report extends Component<{ children?: React.ReactNode }, { failed: boolean }> {
      state = { failed: false }
      static getDerivedStateFromError() { return { failed: true } }
      componentDidCatch(error: unknown) { reported.push(error) }
      render() { return this.state.failed ? null : this.props.children }
    }
    const { useStore, getStore } = createStore('err-wrapper', () => {
      useEffect(() => { throw new Error('effect') }, [])
      return { v: 1 }
    })
    const View = () => { const { v } = useStore(); return <span>{v ?? '-'}</span> }
    const { unmount } = render(<><AutoRootCtx Wrapper={Report} /><View /></>)
    await tick(50)
    expect(reported.map(e => (e as Error).message)).toEqual(['effect'])
    expect((getStore().error as Error).message).toBe('effect')
    unmount()
    await tick(50)
    expect(getStore().error).toBeUndefined()
  })

  it('a consumer that retries after the failed instance was torn down gets a fresh instance', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => { })
    let failNext = true
    const { useStoreSuspense } = createStore('err-retry', () => {
      const [shouldFail] = useState(() => failNext)
      if (shouldFail) throw new Error('once')
      return { v: 'ok' }
    })
    const View = () => { const { v } = useStoreSuspense(); return <span data-testid="v">{v}</span> }
    const App = ({ attempt }: { attempt: number }) =>
      <><AutoRootCtx /><Catch key={attempt}><Suspense fallback={<i />}><View /></Suspense></Catch></>
    const r = render(<App attempt={0} />)
    await tick(50)
    expect(r.queryByTestId('caught')?.textContent).toBe('once')
    failNext = false
    await tick(1100)   // the failed instance is torn down once nothing holds it
    r.rerender(<App attempt={1} />)
    await tick(50)
    expect(r.queryByTestId('v')?.textContent).toBe('ok')
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import React, { Component, useEffect, useState } from 'react'
import { createStore, useMultipleStore, AutoRootCtx } from '../src'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

afterEach(async () => {
  vi.restoreAllMocks()
  await act(() => new Promise(resolve => setTimeout(resolve, 150)))
})

/** An error boundary that shows the message it caught, and counts what it caught. */
class Catch extends Component<{ children: React.ReactNode, testId?: string }, { error?: unknown }> {
  state: { error?: unknown } = {}
  static getDerivedStateFromError(error: unknown) { return { error } }
  render() {
    return this.state.error !== undefined
      ? <b data-testid={this.props.testId ?? 'caught'}>{String((this.state.error as Error).message)}</b>
      : this.props.children
  }
}

/** A store that throws on its first render, or after `crash()`. */
const failing = (name: string, { fromStart = false } = {}) => {
  let crash = () => { }
  const store = createStore(name, ({ id = 'a' }: { id?: string }) => {
    const [broken, setBroken] = useState(fromStart)
    crash = () => setBroken(true)
    if (broken) throw new Error(`${name} ${id} broke`)
    return { id, value: 1 }
  })
  return { ...store, crash: () => crash() }
}

const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => { })

describe('a store hook that throws', () => {
  it('is disabled; storeRef().error reports what it threw while the instance lives', async () => {
    const error = quiet()
    const { storeRef } = createStore('err-ref', () => {
      useEffect(() => { throw new Error('effect') }, [])
      return { v: 1 }
    })
    const { storeRef: otherRef } = createStore('err-ref-other', () => ({ ok: true }))
    render(<AutoRootCtx />)
    let releases: (() => void)[] = []
    act(() => { releases = [storeRef().retain(), otherRef().retain()] })
    await tick(50)
    expect((storeRef().error as Error).message).toBe('effect')
    expect(error.mock.calls.some(call => call.some(arg => (arg as Error)?.message === 'effect'))).toBe(true)
    // the other store keeps running
    expect(otherRef().get().ok).toBe(true)
    expect(otherRef().error).toBeUndefined()
    act(() => releases.forEach(release => release()))
    await tick(50)
    expect(storeRef().error).toBeUndefined()
  })

  it('throws its error in a reader, for the reader\'s own boundary, when it fails before its first result', async () => {
    quiet()
    const { useStore } = failing('err-first', { fromStart: true })
    const { useStore: useOther } = createStore('err-first-other', () => ({ ok: 'yes' }))
    const View = () => <span>{useStore().value ?? '…'}</span>
    const Other = () => <i data-testid="other">{useOther().ok}</i>
    const { queryByTestId } = render(<><AutoRootCtx /><Catch><View /></Catch><Other /></>)
    await tick()
    expect(queryByTestId('caught')?.textContent).toBe('err-first a broke')
    expect(queryByTestId('other')?.textContent).toBe('yes')
  })

  it('throws in every reader when it fails later: proxy, selection and useMultipleStore', async () => {
    quiet()
    const { useStore, storeRef, crash } = failing('err-later')
    const Proxy = () => <span data-testid="proxy">{useStore().value}</span>
    const Select = () => <span data-testid="select">{useStore(undefined, { select: s => s.value })}</span>
    const Many = () => <span data-testid="many">{useMultipleStore([storeRef()])[0].value}</span>
    const Total = () => <span data-testid="total">{useMultipleStore([storeRef()], { select: ([s]) => s!.value })}</span>
    const { queryByTestId } = render(<>
      <AutoRootCtx />
      <Catch testId="c1"><Proxy /></Catch>
      <Catch testId="c2"><Select /></Catch>
      <Catch testId="c3"><Many /></Catch>
      <Catch testId="c4"><Total /></Catch>
    </>)
    await tick()
    expect(['proxy', 'select', 'many', 'total'].map(id => queryByTestId(id)?.textContent)).toEqual(['1', '1', '1', '1'])
    act(() => crash())
    await tick()
    expect(['c1', 'c2', 'c3', 'c4'].map(id => queryByTestId(id)?.textContent)).toEqual(Array(4).fill('err-later a broke'))
  })

  it('useMultipleStore throws the error of the instance that failed, and only where it is read', async () => {
    quiet()
    const { storeRef } = failing('err-many', { fromStart: true })
    const { storeRef: okRef } = createStore('err-many-ok', ({ id }: { id: string }) => ({ id }))
    const Both = () => <span>{useMultipleStore([okRef({ id: 'x' }), storeRef({ id: 'b' })]).map(s => s.id).join(',')}</span>
    const Ok = () => <i data-testid="ok">{useMultipleStore([okRef({ id: 'x' })])[0].id}</i>
    const { queryByTestId } = render(<><AutoRootCtx /><Catch><Both /></Catch><Ok /></>)
    await tick()
    expect(queryByTestId('caught')?.textContent).toBe('err-many b broke')
    expect(queryByTestId('ok')?.textContent).toBe('x')
  })

  it('a reader mounted after the failure throws at once', async () => {
    quiet()
    const { useStore, storeRef } = failing('err-late-reader', { fromStart: true })
    render(<AutoRootCtx />)
    let release = () => { }
    act(() => { release = storeRef().retain() })
    await tick()
    expect(storeRef().error).toBeInstanceOf(Error)
    const View = () => <span>{useStore().value}</span>
    const { queryByTestId } = render(<Catch><View /></Catch>)
    expect(queryByTestId('caught')?.textContent).toBe('err-late-reader a broke')
    act(() => release())
  })

  it('a store that reads a failed store fails with its error', async () => {
    quiet()
    const source = failing('err-source', { fromStart: true })
    const { useStore: useDerived } = createStore('err-derived', () => ({ double: (source.useStore().value ?? 0) * 2 }))
    const View = () => <span>{useDerived().double}</span>
    const { queryByTestId } = render(<><AutoRootCtx /><Catch><View /></Catch></>)
    await tick()
    expect(queryByTestId('caught')?.textContent).toBe('err-source a broke')
  })

  it.each([60_000, Infinity])('starts fresh on a retry right away with a timeToClean of %s', async (timeToClean) => {
    quiet()
    let failNext = true
    const { useStore } = createStore(`err-retry-ttc-${timeToClean}`, () => {
      const [shouldFail] = useState(() => failNext)
      if (shouldFail) throw new Error('once')
      return { v: 'ok' }
    }, { timeToClean })
    const View = () => <span data-testid="v">{useStore().v}</span>
    const App = ({ attempt }: { attempt: number }) => <><AutoRootCtx /><Catch key={attempt}><View /></Catch></>
    const r = render(<App attempt={0} />)
    await tick()
    expect(r.queryByTestId('caught')?.textContent).toBe('once')
    failNext = false
    r.rerender(<App attempt={1} />)
    await tick()
    expect(r.queryByTestId('v')?.textContent).toBe('ok')
  })

  it('is torn down at once when it fails while waiting out its timeToClean', async () => {
    quiet()
    let crash = () => { }
    const { useStore, storeRef } = createStore('err-grace', () => {
      const [broken, setBroken] = useState(false)
      crash = () => setBroken(true)
      if (broken) throw new Error('in the grace period')
      return { v: 'ok' }
    }, { timeToClean: Infinity })
    const View = () => <span data-testid="v">{useStore().v}</span>
    const r = render(<><AutoRootCtx /><View /></>)
    await tick()
    r.rerender(<AutoRootCtx />)                 // no reader: the instance waits out its timeToClean
    await tick()
    act(() => crash())
    await tick()
    expect(storeRef().error).toBeUndefined()    // torn down, its failure cleared
    r.rerender(<><AutoRootCtx /><Catch><View /></Catch></>)
    await tick()
    expect(r.queryByTestId('v')?.textContent).toBe('ok')
  })

  it('stays failed while retained, until the retainer releases it', async () => {
    quiet()
    const { storeRef } = failing('err-retained', { fromStart: true })
    render(<AutoRootCtx />)
    let release = () => { }
    act(() => { release = storeRef().retain() })
    await tick()
    expect(storeRef().error).toBeInstanceOf(Error)
    act(() => release())
    await tick()
    expect(storeRef().error).toBeUndefined()
  })

  it('fails with an Error that says so when the hook throws a falsy value', async () => {
    quiet()
    const { useStore, storeRef } = createStore('err-falsy', (): { v?: number } => { throw undefined })
    render(<AutoRootCtx />)
    let release = () => { }
    act(() => { release = storeRef().retain() })
    await tick()
    const error = storeRef().error as Error
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('[react-state-custom] The hook of "err-falsy" threw undefined')
    expect(error.cause).toBeUndefined()
    const View = () => <span>{useStore().v}</span>
    const r = render(<Catch><View /></Catch>)
    expect(r.queryByTestId('caught')?.textContent).toBe(error.message)
    act(() => release())
  })

  it('starts fresh for a reader that comes back once every reader has gone', async () => {
    quiet()
    let failNext = true
    const { useStore } = createStore('err-retry', () => {
      const [shouldFail] = useState(() => failNext)
      if (shouldFail) throw new Error('once')
      return { v: 'ok' }
    })
    const View = () => <span data-testid="v">{useStore().v}</span>
    const App = ({ attempt }: { attempt: number }) => <><AutoRootCtx /><Catch key={attempt}><View /></Catch></>
    const r = render(<App attempt={0} />)
    await tick()
    expect(r.queryByTestId('caught')?.textContent).toBe('once')
    failNext = false
    // the boundary unmounted the reader: nothing holds the failed instance, which is torn down
    await tick()
    r.rerender(<App attempt={1} />)
    await tick()
    expect(r.queryByTestId('v')?.textContent).toBe('ok')
  })
})

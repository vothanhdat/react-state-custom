import { describe, it, expect } from 'vitest'
import { render, act, screen } from '@testing-library/react'
import { Profiler, useState, type ReactNode } from 'react'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

/** A store whose `id` tells instances apart: a remount gets a new id. */
const instanceStore = (name: string, timeToClean = 0) => {
  let next = 0
  return createStore(name, () => {
    const [id] = useState(() => ++next)
    return { id }
  }, timeToClean)
}

describe('AutoRootCtx reference counting', () => {
  it('a consumer joining or leaving a running instance does not re-render AutoRootCtx', async () => {
    const { useStore } = instanceStore('refcount-join')
    let autoCommits = 0
    const Reader = () => <i>{useStore().id}</i>
    let setExtra!: (show: boolean) => void
    // the toggle lives in its own component so AutoRootCtx's parent never re-renders
    const Extra = () => { const [show, set] = useState(false); setExtra = set; return show ? <Reader /> : null }
    render(<>
      <Profiler id="auto" onRender={() => autoCommits++}><AutoRootCtx /></Profiler>
      <Reader />
      <Extra />
    </>)
    await tick()
    autoCommits = 0
    act(() => setExtra(true))
    await tick()
    act(() => setExtra(false))
    await tick()
    expect(autoCommits).toBe(0)
  })

  it('timeToClean keeps the instance for a consumer that comes back in time, and tears it down after', async () => {
    const { useStore } = instanceStore('refcount-keep', 100)
    const Reader = () => <b data-testid="id">{useStore().id}</b>
    const App = ({ show }: { show: boolean }) => <><AutoRootCtx />{show && <Reader />}</>
    const { rerender } = render(<App show={true} />)
    await tick()
    const first = screen.getByTestId('id').textContent

    rerender(<App show={false} />)
    await tick(50)
    rerender(<App show={true} />)
    await tick()
    expect(screen.getByTestId('id').textContent).toBe(first)

    rerender(<App show={false} />)
    await tick(150)
    rerender(<App show={true} />)
    await tick()
    expect(screen.getByTestId('id').textContent).not.toBe(first)
  })

  it('without timeToClean the instance stops with its last consumer and a new one starts fresh', async () => {
    const { useStore } = instanceStore('refcount-drop')
    const Reader = () => <b data-testid="id">{useStore().id}</b>
    const App = ({ show }: { show: boolean }) => <><AutoRootCtx />{show && <Reader />}</>
    const { rerender } = render(<App show={true} />)
    await tick()
    const first = screen.getByTestId('id').textContent
    rerender(<App show={false} />)
    await tick()
    rerender(<App show={true} />)
    await tick()
    expect(screen.getByTestId('id').textContent).not.toBe(first)
  })

  it('a retain keeps the instance after every consumer is gone', async () => {
    const { useStore, getStore } = instanceStore('refcount-retain')
    const Reader = () => <b data-testid="id">{useStore().id}</b>
    const App = ({ show }: { show: boolean }) => <><AutoRootCtx />{show && <Reader />}</>
    const { rerender } = render(<App show={true} />)
    await tick()
    const first = screen.getByTestId('id').textContent
    const release = getStore().retain()
    rerender(<App show={false} />)
    await tick()
    expect(getStore().get().id).toBe(Number(first))
    rerender(<App show={true} />)
    await tick()
    expect(screen.getByTestId('id').textContent).toBe(first)
    act(() => release())
  })

  it('calling a release twice counts once', async () => {
    const { useStore, getStore } = instanceStore('refcount-double-release')
    const Reader = () => <b data-testid="id">{useStore().id}</b>
    render(<><AutoRootCtx /><Reader /></>)
    await tick()
    const first = screen.getByTestId('id').textContent
    const release = getStore().retain()
    await tick()
    act(() => { release(); release() })
    await tick()
    // the component's own subscription still holds the instance
    expect(screen.getByTestId('id').textContent).toBe(first)
  })

  it('starting an instance re-renders only a share of the running instances', async () => {
    const { useStore } = createStore('refcount-buckets', ({ id }: { id: number }) => ({ id }))
    let wrapperRenders = 0
    const CountingWrapper = ({ children }: { children?: ReactNode }) => { wrapperRenders++; return <>{children}</> }
    const Row = ({ id }: { id: number }) => <i>{useStore({ id }).id}</i>
    let setExtra!: (show: boolean) => void
    const Extra = () => { const [show, set] = useState(false); setExtra = set; return show ? <Row id={-1} /> : null }
    render(<>
      <AutoRootCtx Wrapper={CountingWrapper} />
      {Array.from({ length: 640 }, (_, i) => <Row key={i} id={i} />)}
      <Extra />
    </>)
    await tick()
    wrapperRenders = 0
    act(() => setExtra(true))
    await tick()
    // one bucket of ~10 instances re-renders (twice under StrictMode), not all 640
    expect(wrapperRenders).toBeGreaterThan(0)
    expect(wrapperRenders).toBeLessThan(100)
  })
})

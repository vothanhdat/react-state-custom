import React, { useEffect, useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AutoRootCtx, createStore } from '../src'

// These tests pin the number of consumer renders on the first-data path. They render without
// StrictMode (which doubles renders) so the counts are the ones a production app sees.
const noStrict = { reactStrictMode: false }
const tick = (ms = 0) => act(() => new Promise<void>(r => setTimeout(r, ms)))

describe('render count on first data', () => {
  it('store and AutoRootCtx mount together: 2 renders (initial + first publish)', async () => {
    const { useStore } = createStore('rc-together', () => {
      const [count, setCount] = useState(5)
      return { count, increment: () => setCount(c => c + 1) }
    })
    let renders = 0
    const Consumer = () => {
      renders++
      const { count, increment } = useStore()
      return <button data-testid="btn" onClick={increment}>{count ?? 'none'}</button>
    }
    render(<><AutoRootCtx /><Consumer /></>, noStrict)
    await tick()
    expect(screen.getByTestId('btn').textContent).toBe('5')
    expect(renders).toBe(2)
  })

  it('AutoRootCtx already mounted: 2 renders', async () => {
    const { useStore } = createStore('rc-late', () => {
      const [count, setCount] = useState(7)
      return { count, increment: () => setCount(c => c + 1) }
    })
    let renders = 0
    const Consumer = () => {
      renders++
      const { count, increment } = useStore()
      return <button data-testid="btn" onClick={increment}>{count ?? 'none'}</button>
    }
    const App = () => {
      const [show, setShow] = useState(false)
      useEffect(() => { setShow(true) }, [])
      return <><AutoRootCtx />{show && <Consumer />}</>
    }
    render(<App />, noStrict)
    await tick()
    expect(screen.getByTestId('btn').textContent).toBe('7')
    expect(renders).toBe(2)
  })

  it('a second consumer of an already running store: 1 render', async () => {
    const { useStore } = createStore('rc-second', () => {
      const [count] = useState(3)
      return { count }
    })
    let first = 0
    let second = 0
    const First = React.memo(() => { first++; const { count } = useStore(); return <span data-testid="a">{count ?? 'none'}</span> })
    const Second = () => { second++; const { count } = useStore(); return <span data-testid="b">{count ?? 'none'}</span> }
    const App = () => {
      const [show, setShow] = useState(false)
      return <><AutoRootCtx /><First />{show && <Second />}<button data-testid="show" onClick={() => setShow(true)} /></>
    }
    render(<App />, noStrict)
    await tick()
    expect(screen.getByTestId('a').textContent).toBe('3')
    act(() => { screen.getByTestId('show').click() })
    await tick()
    expect(screen.getByTestId('b').textContent).toBe('3')
    expect(second).toBe(1)
    expect(first).toBe(2)
  })

  it('an update re-renders only once per published change', async () => {
    const { useStore } = createStore('rc-update', () => {
      const [count, setCount] = useState(0)
      return { count, increment: () => setCount(c => c + 1) }
    })
    let renders = 0
    const Consumer = () => {
      renders++
      const { count, increment } = useStore()
      return <button data-testid="btn" onClick={increment}>{count ?? 'none'}</button>
    }
    render(<><AutoRootCtx /><Consumer /></>, noStrict)
    await tick()
    const before = renders
    act(() => { screen.getByTestId('btn').click() })
    await tick()
    expect(screen.getByTestId('btn').textContent).toBe('1')
    expect(renders - before).toBe(1)
  })
})

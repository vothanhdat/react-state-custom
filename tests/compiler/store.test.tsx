import React, { Profiler, useEffect, useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AutoRootCtx, createStore, useMultipleStore } from '../../src'
import { COMPILED } from './canary.test'

// Everything in this file (store hooks and components) is compiled by the React Compiler.
const tick = (ms = 0) => act(() => new Promise<void>(r => setTimeout(r, ms)))
// Render counts are asserted without StrictMode, which doubles them.
const noStrict = { reactStrictMode: false }

const useCounterState = ({ step = 1 }: { step?: number }) => {
  const [count, setCount] = useState(0)
  const [label, setLabel] = useState('a')
  const increment = () => setCount(c => c + step)
  const rename = (next: string) => setLabel(next)
  return { count, label, increment, rename, double: count * 2 }
}

// Stores live at module scope, as in an app: the compiler moves callbacks that capture nothing from
// the component (`step => multiple.storeRef({ step })`) to module scope.
const selectOption = createStore('compiler-select-option', useCounterState)
const multiple = createStore('compiler-multiple', useCounterState)
// passed whole to a helper: the compiler memoises the helper's result on the proxy's identity
const countText = (s: { count?: number }) => `${s.count}`

describe('react-state-custom under the React Compiler', () => {
  it('store hooks are compiled too', () => {
    expect(useCounterState.toString()).toMatch(COMPILED)
  })

  it('useStore proxy: a compiled consumer re-renders with the new value', async () => {
    const { useStore } = createStore('compiler-counter', useCounterState)
    const Consumer = () => {
      const { count, increment } = useStore()
      return <button data-testid="btn" onClick={increment}>{count ?? 'none'}</button>
    }
    expect(Consumer.toString()).toMatch(COMPILED)
    render(<><AutoRootCtx /><Consumer /></>)
    await tick()
    expect(screen.getByTestId('btn').textContent).toBe('0')
    act(() => { screen.getByTestId('btn').click() })
    await tick()
    expect(screen.getByTestId('btn').textContent).toBe('1')
    act(() => { screen.getByTestId('btn').click() })
    await tick()
    expect(screen.getByTestId('btn').textContent).toBe('2')
  })

  it('useStore proxy: reads only during render keep selective re-rendering', async () => {
    const { useStore } = createStore('compiler-selective', useCounterState)
    let countRenders = 0
    let labelRenders = 0
    const Count = () => { countRenders++; const { count } = useStore(); return <i data-testid="count">{count}</i> }
    const Label = () => { labelRenders++; const { label } = useStore(); return <i data-testid="label">{label}</i> }
    let actions: { increment?: () => void, rename?: (s: string) => void } = {}
    const Actions = () => { const { increment, rename } = useStore(); useEffect(() => { actions = { increment, rename } }); return null }
    render(<><AutoRootCtx /><Count /><Label /><Actions /></>, noStrict)
    await tick()
    const c0 = countRenders
    const l0 = labelRenders
    act(() => actions.increment!())
    await tick()
    expect(screen.getByTestId('count').textContent).toBe('1')
    expect(countRenders).toBe(c0 + 1)
    expect(labelRenders).toBe(l0)
    act(() => actions.rename!('b'))
    await tick()
    expect(screen.getByTestId('label').textContent).toBe('b')
    expect(labelRenders).toBe(l0 + 1)
    expect(countRenders).toBe(c0 + 1)
  })

  it('passing the whole store object to a helper still tracks the keys the helper reads', async () => {
    const { useStore, storeRef } = createStore('compiler-whole-object', useCounterState)
    // The compiler memoises `describe(s)` on the identity of `s`. If the proxy were stable across
    // renders the cached text would go stale and the read of `count` would stop being tracked.
    const describe = (s: { count?: number, label?: string }) => `${s.label}:${s.count}`
    const Consumer = () => {
      const s = useStore()
      const text = describe(s)
      return <i data-testid="v">{text}</i>
    }
    render(<><AutoRootCtx /><Consumer /></>)
    await tick()
    expect(screen.getByTestId('v').textContent).toBe('a:0')
    act(() => storeRef().get().increment!())
    await tick()
    expect(screen.getByTestId('v').textContent).toBe('a:1')
    act(() => storeRef().get().rename!('z'))
    await tick()
    expect(screen.getByTestId('v').textContent).toBe('z:1')
    act(() => storeRef().get().increment!())
    await tick()
    expect(screen.getByTestId('v').textContent).toBe('z:2')
  })

  it('useStore(params, { select }) re-renders only when the selection changes', async () => {
    let commits = 0
    const Consumer = () => {
      const parity = selectOption.useStore({}, { select: s => ['parity', (s.count ?? 0) % 2] })
      return <i data-testid="v">{parity.join(':')}</i>
    }
    expect(Consumer.toString()).toMatch(COMPILED)
    render(<><AutoRootCtx /><Profiler id="c" onRender={() => { commits++ }}><Consumer /></Profiler></>, noStrict)
    await tick()
    expect(screen.getByTestId('v').textContent).toBe('parity:0')
    const settled = commits
    act(() => selectOption.storeRef().get().rename!('z'))
    await tick()
    expect(commits).toBe(settled)
    act(() => selectOption.storeRef().get().increment!())
    await tick()
    expect(screen.getByTestId('v').textContent).toBe('parity:1')
    expect(commits).toBe(settled + 1)
  })

  it('useMultipleStore over a list, with proxies and with select', async () => {
    const List = ({ steps }: { steps: number[] }) => {
      const items = useMultipleStore(steps.map(step => multiple.storeRef({ step })))
      const total = useMultipleStore(steps.map(step => multiple.storeRef({ step })), { select: states => states.reduce((sum, s) => sum + (s.count ?? 0), 0) })
      return <i data-testid="v">{items.map(countText).join(',')}={total}</i>
    }
    expect(List.toString()).toMatch(COMPILED)
    const { rerender } = render(<><AutoRootCtx /><List steps={[1, 5]} /></>)
    await tick()
    expect(screen.getByTestId('v').textContent).toBe('0,0=0')
    act(() => multiple.storeRef({ step: 5 }).get().increment!())
    await tick()
    expect(screen.getByTestId('v').textContent).toBe('0,5=5')
    rerender(<><AutoRootCtx /><List steps={[1, 5, 10]} /></>)
    await tick()
    act(() => multiple.storeRef({ step: 10 }).get().increment!())
    await tick()
    expect(screen.getByTestId('v').textContent).toBe('0,5,10=15')
  })

  it('parameterised stores', async () => {
    const { useStore } = createStore('compiler-params', useCounterState)
    const Consumer = ({ step }: { step: number }) => {
      const { count, increment } = useStore({ step })
      return <button data-testid={`btn-${step}`} onClick={increment}>{count}</button>
    }
    render(<><AutoRootCtx /><Consumer step={1} /><Consumer step={5} /></>)
    await tick()
    act(() => { screen.getByTestId('btn-5').click() })
    await tick()
    expect(screen.getByTestId('btn-5').textContent).toBe('5')
    expect(screen.getByTestId('btn-1').textContent).toBe('0')
  })
})

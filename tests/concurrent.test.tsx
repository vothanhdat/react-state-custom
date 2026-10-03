import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import { Suspense, startTransition, useState } from 'react'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

describe('a transition that suspends', () => {
  // The transition renders Reader reading only `b`, then a sibling suspends: React keeps the committed
  // UI, which reads `a`, on screen while it waits. That UI must keep following `a`.
  const setup = (Reader: React.FC<{ mode: 'a' | 'b' }>) => {
    const never = new Promise<void>(() => {})
    const Suspender = ({ on }: { on: boolean }) => { if (on) throw never; return null }
    let setMode: (m: 'a' | 'b') => void = () => {}
    const App = () => {
      const [mode, _setMode] = useState<'a' | 'b'>('a')
      setMode = _setMode
      return <Suspense fallback="loading"><Reader mode={mode} /><Suspender on={mode === 'b'} /></Suspense>
    }
    const utils = render(<><AutoRootCtx /><App /></>)
    return { ...utils, setMode: (m: 'a' | 'b') => setMode(m) }
  }

  const createAB = (name: string) => {
    let setA: (n: number) => void = () => {}
    const store = createStore(name, () => {
      const [a, _setA] = useState(0)
      setA = _setA
      return { a, b: 'B' }
    })
    return { ...store, setA: (n: number) => setA(n) }
  }

  it('keeps the UI on screen subscribed to the keys it read (proxy)', async () => {
    const { useStore, setA } = createAB('transition-proxy')
    const Reader = ({ mode }: { mode: 'a' | 'b' }) => {
      const s = useStore()
      return <span data-testid="v">{mode === 'a' ? String(s.a) : s.b}</span>
    }
    const { getByTestId, setMode } = setup(Reader)
    await tick()
    expect(getByTestId('v').textContent).toBe('0')

    act(() => { startTransition(() => setMode('b')) })
    await tick()
    expect(getByTestId('v').textContent).toBe('0')

    act(() => { setA(5) })
    await tick()
    expect(getByTestId('v').textContent).toBe('5')
  })

  it('keeps the UI on screen subscribed to its selection (selector)', async () => {
    const { useStore, setA } = createAB('transition-selector')
    const Reader = ({ mode }: { mode: 'a' | 'b' }) => {
      const v = useStore(undefined, s => mode === 'a' ? String(s.a) : s.b)
      return <span data-testid="v">{v}</span>
    }
    const { getByTestId, setMode } = setup(Reader)
    await tick()
    act(() => { startTransition(() => setMode('b')) })
    await tick()
    act(() => { setA(5) })
    await tick()
    expect(getByTestId('v').textContent).toBe('5')
  })
})

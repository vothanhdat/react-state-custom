import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { createStore, AutoRootCtx } from '../src'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })
afterEach(() => vi.restoreAllMocks())

const makeCounter = (name: string) => createStore(name, () => {
  const [n, setN] = useState(0)
  return { n, increment: () => setN(c => c + 1) }
})

describe('several AutoRootCtx in one scope', () => {
  it('stores keep running in the remaining root after the newest one unmounts', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => { })
    const { useStore } = makeCounter('multi-root-handover')
    const View = ({ id }: { id: string }) => {
      const { n, increment } = useStore()
      return <button data-testid={id} onClick={() => increment?.()}>{String(n)}</button>
    }
    const App = ({ second, late }: { second: boolean, late: boolean }) => <>
      <AutoRootCtx />
      {second && <AutoRootCtx />}
      <View id="a" />
      {late && <View id="b" />}
    </>
    const r = render(<App second={false} late={false} />)
    await tick()
    r.rerender(<App second={true} late={false} />)
    await tick()
    r.rerender(<App second={false} late={false} />)
    await tick()
    fireEvent.click(r.getByTestId('a'))
    await tick()
    expect(r.getByTestId('a').textContent).toBe('1')

    // a consumer mounted after the hand-over is served too
    r.rerender(<App second={false} late={true} />)
    await tick()
    fireEvent.click(r.getByTestId('b'))
    await tick()
    expect(r.getByTestId('a').textContent).toBe('2')
    expect(r.getByTestId('b').textContent).toBe('2')
  })

  it('logs a development error when a second root mounts in the same scope', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => { })
    render(<><AutoRootCtx /><AutoRootCtx /></>)
    await tick()
    expect(error.mock.calls.filter(c => String(c[0]).includes('More than one <AutoRootCtx />'))).toHaveLength(1)
  })

  it('without any root left, a new consumer is told so instead of attaching to an unmounted root', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => { })
    const { useStore } = makeCounter('multi-root-none')
    const View = () => { const { n } = useStore(); return <span data-testid="v">{n ?? '-'}</span> }
    const r = render(<AutoRootCtx />)
    await tick()
    r.rerender(<View />)
    await tick(1100)
    expect(error.mock.calls.some(c => String(c[0]).includes('no <AutoRootCtx />'))).toBe(true)
  })
})

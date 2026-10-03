import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import React, { useState } from 'react'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })
afterEach(() => vi.restoreAllMocks())

describe('AutoRootCtx props', () => {
  it('a Wrapper defined at module scope keeps every store across re-renders of its parent', async () => {
    let inits = 0
    const { useStore } = createStore('props-stable-wrapper', () => {
      const [n] = useState(() => { inits++; return 0 })
      return { n }
    })
    const Wrapper = ({ children }: { children?: React.ReactNode }) => <>{children}</>
    const View = () => { const { n } = useStore(); return <span>{n}</span> }
    const App = ({ t }: { t: number }) => <><AutoRootCtx Wrapper={Wrapper} /><i>{t}</i><View /></>
    const error = vi.spyOn(console, 'error')
    const r = render(<App t={0} />)
    await tick()
    const before = inits
    r.rerender(<App t={1} />)
    await tick()
    expect(inits).toBe(before)
    expect(error).not.toHaveBeenCalled()
  })

  it('logs a development error when the Wrapper changes identity, since every store remounts', async () => {
    const { useStore } = createStore('props-inline-wrapper', () => ({ n: 1 }))
    const View = () => { const { n } = useStore(); return <span>{n}</span> }
    const App = ({ t }: { t: number }) => <>
      <AutoRootCtx Wrapper={({ children }) => <>{children}</>} />
      <i>{t}</i><View />
    </>
    const error = vi.spyOn(console, 'error').mockImplementation(() => { })
    const r = render(<App t={0} />)
    await tick()
    expect(error).not.toHaveBeenCalled()
    r.rerender(<App t={1} />)
    await tick()
    expect(error.mock.calls.filter(c => String(c[0]).includes('Wrapper passed to <AutoRootCtx />'))).toHaveLength(1)
  })
})

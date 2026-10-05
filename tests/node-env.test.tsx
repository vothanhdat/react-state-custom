import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import { useState } from 'react'
import { createStore, useMultipleStore, AutoRootCtx } from '../src'

/**
 * Where no bundler replaces `process.env.NODE_ENV` (Node: test runners, server rendering of
 * unbundled packages), `process.env` is a native lookup costing ~150 ns per read. Development checks
 * run on every render, so they must read it once, at module load: reading it at each check made
 * every update 6-16% slower in the jsdom benchmarks.
 */
describe('development checks in Node', () => {
  it('do not read process.env while rendering', async () => {
    let bump = () => { }
    const { useStore, storeRef } = createStore('node-env', () => {
      const [n, setN] = useState(0)
      bump = () => setN(x => x + 1)
      return { n, double: n * 2 }
    })
    const Proxy_ = ({ i }: { i: number }) => <i>{(useStore().n ?? 0) + i}</i>
    const Selector = () => <b>{useStore(undefined, { select: s => s.double })}</b>
    const Multiple = () => <u>{useMultipleStore([storeRef()])[0].n}</u>
    const Total = () => <s>{useMultipleStore([storeRef()], { select: ([s]) => s!.double })}</s>

    const env = process.env
    let reads = 0
    process.env = new Proxy(env, {
      get(target, key) {
        if (key === 'NODE_ENV') reads++
        return Reflect.get(target, key)
      },
    })
    try {
      const { container } = render(<>
        <AutoRootCtx />
        {Array.from({ length: 20 }, (_, i) => <Proxy_ key={i} i={i} />)}
        <Selector />
        <Multiple />
        <Total />
      </>)
      await act(async () => { })
      await act(async () => { bump() })
      expect(container.querySelector('b')!.textContent).toBe('2')
      expect(reads).toBe(0)
    } finally {
      process.env = env
    }
  })
})

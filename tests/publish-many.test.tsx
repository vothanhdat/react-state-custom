import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import { useState } from 'react'
import { createStore, AutoRootCtx } from '../src'
import { Context } from '../src/state-utils/ctx'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

describe('one store update is one consistent state', () => {
  it('storeRef().subscribe never sees a key updated next to another one still old', async () => {
    const { storeRef } = createStore('publish-many-handle', () => {
      const [price, setPrice] = useState(1)
      return { price, total: price * 2, setPrice }
    })
    render(<AutoRootCtx />)
    const release = storeRef().retain()
    await tick()
    const seen: string[] = []
    const unsub = storeRef().subscribe((s, key) => seen.push(`${String(key)}: ${s.price}/${s.total}`))
    act(() => storeRef().get().setPrice!(10))
    await tick()
    expect(seen).toEqual(['price: 10/20', 'total: 10/20'])
    unsub()
    release()
  })

  it('Context.publishMany assigns and removes every key before notifying, and skips equal values', () => {
    const ctx = new Context<{ a: number, b: number, c: number }>('publish-many-unit')
    ctx.data = { a: 1, b: 2, c: 3 }
    const calls: string[] = []
    ctx.subscribe('a', v => calls.push(`a=${v} b=${ctx.data.b} c=${'c' in ctx.data}`))
    ctx.subscribeAll(key => calls.push(`all:${String(key)}`))
    calls.length = 0
    ctx.publishMany([['a', 10], ['b', 20], ['c', 3]], ['c'])
    expect(calls).toEqual(['a=10 b=20 c=false', 'all:a', 'all:b', 'all:c'])
    expect(ctx.data).toEqual({ a: 10, b: 20 })
  })
})

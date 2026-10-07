import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import { useMemo, useState } from 'react'
import { createStore, useMultipleStore, AutoRootCtx } from '../src'
import { shallowEqual } from '../src/state-utils/utils'

describe('shallowEqual', () => {
  it('compares arrays, plain objects, maps and sets one level deep', () => {
    const item = { id: 1 }
    expect(shallowEqual([1, 'a', item], [1, 'a', item])).toBe(true)
    expect(shallowEqual([1, 2], [1, 2, 3])).toBe(false)
    expect(shallowEqual([{ id: 1 }], [{ id: 1 }])).toBe(false)          // one level only
    expect(shallowEqual({ a: 1, b: item }, { b: item, a: 1 })).toBe(true)
    expect(shallowEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(shallowEqual({ a: undefined }, { b: undefined })).toBe(false)
    expect(shallowEqual(new Map([['a', item]]), new Map([['a', item]]))).toBe(true)
    expect(shallowEqual(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(false)
    expect(shallowEqual(new Set([1, item]), new Set([item, 1]))).toBe(true)
    expect(shallowEqual(new Set([1]), new Set([2]))).toBe(false)
    expect(shallowEqual(NaN, NaN)).toBe(true)
    expect(shallowEqual(0, -0)).toBe(false)
  })

  it('compares every index of an array, holes included', () => {
    expect(shallowEqual(new Array(1), [42])).toBe(false)
    expect(shallowEqual([42], new Array(1))).toBe(false)
    expect(shallowEqual(new Array(1), [undefined])).toBe(false)          // map() skips a hole
    expect(shallowEqual([undefined], new Array(1))).toBe(false)
    expect(shallowEqual(new Array(2), new Array(2))).toBe(true)
    expect(shallowEqual([, 1], [, 1])).toBe(true)
    expect(shallowEqual([, 1], [1, ,])).toBe(false)
  })

  it('treats other objects as equal only when they are the same object', () => {
    expect(shallowEqual(new Date(1), new Date(2))).toBe(false)
    expect(shallowEqual(new Date(1), new Date(1))).toBe(false)
    class Point { constructor(public x: number) { } }
    expect(shallowEqual(new Point(1), new Point(1))).toBe(false)
    expect(shallowEqual([1], { 0: 1, length: 1 })).toBe(false)
    expect(shallowEqual({}, [])).toBe(false)
    expect(shallowEqual(null, {})).toBe(false)
  })

  it('is the default isEqual of select: a derived array that keeps its contents does not re-render', async () => {
    const { useStore, storeRef } = createStore('shallow-equal-ids', () => {
      const [tasks, setTasks] = useState({ a: 'todo', b: 'todo' } as Record<string, string>)
      const ids = useMemo(() => Object.keys(tasks).sort(), [tasks])   // a new array whenever tasks changes
      return { tasks, ids, setStatus: (id: string, status: string) => setTasks(t => ({ ...t, [id]: status })) }
    })
    let plain = 0, shallow = 0
    const Plain = () => { plain++; useStore(undefined, { select: s => s.ids, isEqual: Object.is }); return null }
    const Shallow = () => { shallow++; useStore(undefined, { select: s => s.ids }); return null }
    render(<><AutoRootCtx /><Plain /><Shallow /></>)
    await act(async () => { })
    const before = { plain, shallow }
    await act(async () => { storeRef().get().setStatus!('a', 'done') })
    expect(plain).toBeGreaterThan(before.plain)
    expect(shallow).toBe(before.shallow)
  })

  it('re-renders a selection when a hole of a sparse array is filled', async () => {
    const { useStore, storeRef } = createStore('shallow-equal-slots', () => {
      const [slots, setSlots] = useState<(number | undefined)[]>(() => new Array(3))
      return { slots, place: (i: number, value: number) => setSlots(s => { const next = s.slice(); next[i] = value; return next }) }
    })
    const show = (slots: readonly (number | undefined)[]) => Array.from(slots, v => v ?? '_').join(',')
    const One = () => <p>one {show(useStore(undefined, { select: s => s.slots ?? [] }))}</p>
    const Many = () => <p>many {show(useMultipleStore([storeRef()], { select: ([s]) => s?.slots ?? [] }))}</p>
    const { container } = render(<><AutoRootCtx /><One /><Many /></>)
    await act(async () => { })
    expect(container.textContent).toBe('one _,_,_many _,_,_')
    await act(async () => { storeRef().get().place!(1, 42) })
    expect(container.textContent).toBe('one _,42,_many _,42,_')
  })
})

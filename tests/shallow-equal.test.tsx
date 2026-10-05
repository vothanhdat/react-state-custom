import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import { useMemo, useState } from 'react'
import { createStore, AutoRootCtx, shallowEqual } from '../src'

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

  it('treats other objects as equal only when they are the same object', () => {
    expect(shallowEqual(new Date(1), new Date(2))).toBe(false)
    expect(shallowEqual(new Date(1), new Date(1))).toBe(false)
    class Point { constructor(public x: number) { } }
    expect(shallowEqual(new Point(1), new Point(1))).toBe(false)
    expect(shallowEqual([1], { 0: 1, length: 1 })).toBe(false)
    expect(shallowEqual({}, [])).toBe(false)
    expect(shallowEqual(null, {})).toBe(false)
  })

  it('keeps a selector reader from re-rendering when a derived array keeps its contents', async () => {
    const { useStore, getStore } = createStore('shallow-equal-ids', () => {
      const [tasks, setTasks] = useState({ a: 'todo', b: 'todo' } as Record<string, string>)
      const ids = useMemo(() => Object.keys(tasks).sort(), [tasks])   // a new array whenever tasks changes
      return { tasks, ids, setStatus: (id: string, status: string) => setTasks(t => ({ ...t, [id]: status })) }
    })
    let plain = 0, shallow = 0
    const Plain = () => { plain++; useStore(undefined, s => s.ids); return null }
    const Shallow = () => { shallow++; useStore(undefined, s => s.ids, shallowEqual); return null }
    render(<><AutoRootCtx /><Plain /><Shallow /></>)
    await act(async () => { })
    const before = { plain, shallow }
    await act(async () => { getStore().get().setStatus!('a', 'done') })
    expect(plain).toBeGreaterThan(before.plain)
    expect(shallow).toBe(before.shallow)
  })
})

import { describe, expect, it, vi } from 'vitest'
import { formatState, ObservableMap } from '../src/state-utils/utils'

describe('formatState', () => {
  it('keeps what JSON.stringify drops: functions, undefined, bigint, symbols', () => {
    const text = formatState({ count: 1, increment: function increment() { }, reset: () => { }, missing: undefined, big: 10n, sym: Symbol('s') })
    expect(text).toContain('"increment": "ƒ increment()"')
    expect(text).toContain('"reset": "ƒ reset()"')
    expect(text).toContain('"missing": "undefined"')
    expect(text).toContain('"big": "10n"')
    expect(text).toContain('"sym": "Symbol(s)"')
  })

  it('renders Map, Set and Error contents', () => {
    const text = formatState({ m: new Map([['a', 1]]), s: new Set([1, 2]), e: new RangeError('bad') })
    expect(JSON.parse(text)).toEqual({ m: { a: 1 }, s: [1, 2], e: 'RangeError: bad' })
  })

  it('marks cycles instead of throwing, and keeps repeated (non-cyclic) references', () => {
    const shared = { x: 1 }
    const value: any = { a: shared, b: shared }
    value.self = value
    expect(JSON.parse(formatState(value))).toEqual({ a: { x: 1 }, b: { x: 1 }, self: '[Circular]' })
  })

  it('formats a bare undefined', () => {
    expect(formatState(undefined)).toBe('undefined')
  })
})

describe('ObservableMap', () => {
  it('notifies on set, delete and clear, but not when nothing changed', () => {
    const map = new ObservableMap<string, number>()
    const listener = vi.fn()
    const unsubscribe = map.subscribe(listener)

    map.set('a', 1)
    expect(listener).toHaveBeenCalledTimes(1)
    map.set('a', 1)                      // same value: no change
    expect(listener).toHaveBeenCalledTimes(1)
    map.set('a', 2)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(map.delete('zzz')).toBe(false) // absent: no change
    expect(listener).toHaveBeenCalledTimes(2)
    expect(map.delete('a')).toBe(true)
    expect(listener).toHaveBeenCalledTimes(3)
    map.clear()                           // already empty: no change
    expect(listener).toHaveBeenCalledTimes(3)
    map.set('b', 1)
    map.clear()
    expect(listener).toHaveBeenCalledTimes(5)

    unsubscribe()
    map.set('c', 1)
    expect(listener).toHaveBeenCalledTimes(5)
  })
})

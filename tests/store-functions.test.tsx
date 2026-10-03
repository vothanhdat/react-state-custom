import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import { memo, useCallback, useState } from 'react'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

// A store whose getter is memoized on its data, the usual React way to publish a function as a value
const makeItems = (name: string) => createStore(name, () => {
  const [items, setItems] = useState<Record<string, string>>({ a: 'A1' })
  const getItem = useCallback((id: string) => items[id], [items])
  const [other, setOther] = useState(0)
  return { getItem, setItems, other, setOther }
})

describe('functions returned by a store', () => {
  it('a getter called during render re-renders its consumer when the store returns a new one', async () => {
    const { useStore, getStore } = makeItems('fn-getter')
    let renders = 0
    const View = () => {
      renders++
      const { getItem } = useStore()
      return <span data-testid="v">{getItem?.('a') ?? '-'}</span>
    }
    const { getByTestId } = render(<><AutoRootCtx /><View /></>)
    await tick()
    expect(getByTestId('v').textContent).toBe('A1')

    act(() => getStore().get().setItems!({ a: 'A2' }))
    await tick()
    expect(getByTestId('v').textContent).toBe('A2')

    // a change the getter does not depend on leaves the consumer alone
    const before = renders
    act(() => getStore().get().setOther!(1))
    await tick()
    expect(renders).toBe(before)
  })

  it('a selector that calls a store function follows its implementation', async () => {
    const { useStore, getStore } = makeItems('fn-selector')
    const View = () => {
      const a = useStore(undefined, s => s.getItem?.('a'))
      return <span data-testid="v">{a ?? '-'}</span>
    }
    const { getByTestId } = render(<><AutoRootCtx /><View /></>)
    await tick()
    expect(getByTestId('v').textContent).toBe('A1')
    act(() => getStore().get().setItems!({ a: 'A2' }))
    await tick()
    expect(getByTestId('v').textContent).toBe('A2')
  })

  it('a memoized child that calls a getter passed as a prop re-renders with the new implementation', async () => {
    const { useStore, getStore } = makeItems('fn-memo-child')
    const Child = memo(({ getItem }: { getItem?: (id: string) => string | undefined }) =>
      <span data-testid="v">{getItem?.('a') ?? '-'}</span>)
    const Parent = () => {
      const { getItem } = useStore()
      return <Child getItem={getItem} />
    }
    const { getByTestId } = render(<><AutoRootCtx /><Parent /></>)
    await tick()
    expect(getByTestId('v').textContent).toBe('A1')
    act(() => getStore().get().setItems!({ a: 'A2' }))
    await tick()
    expect(getByTestId('v').textContent).toBe('A2')
  })

  it('a function held in state (a sort order) reaches consumers when it is replaced', async () => {
    const byName = (a: string, b: string) => a.localeCompare(b)
    const byNameDesc = (a: string, b: string) => b.localeCompare(a)
    const { useStore, getStore } = createStore('fn-state', () => {
      const [compare, setCompare] = useState(() => byName)
      return { compare, setCompare }
    })
    const View = () => {
      const { compare } = useStore()
      return <span data-testid="v">{compare ? ['b', 'a', 'c'].sort(compare).join('') : '-'}</span>
    }
    const { getByTestId } = render(<><AutoRootCtx /><View /></>)
    await tick()
    expect(getByTestId('v').textContent).toBe('abc')
    act(() => getStore().get().setCompare!(() => byNameDesc))
    await tick()
    expect(getByTestId('v').textContent).toBe('cba')
  })

  it('a component returned by a store remounts when the store switches to another one', async () => {
    const Light = () => { const [label] = useState('light'); return <b data-testid="v">{label}</b> }
    const Dark = () => <b data-testid="v">dark</b>
    const { useStore, getStore } = createStore('fn-component', () => {
      const [dark, setDark] = useState(false)
      return { Icon: dark ? Dark : Light, setDark }
    })
    const View = () => {
      const { Icon } = useStore()
      return Icon ? <Icon /> : null
    }
    const { getByTestId } = render(<><AutoRootCtx /><View /></>)
    await tick()
    expect(getByTestId('v').textContent).toBe('light')
    act(() => getStore().get().setDark!(true))
    await tick()
    expect(getByTestId('v').textContent).toBe('dark')
  })

  it('actions keep one identity per component and do not re-render readers when their closure changes', async () => {
    const { useStore, getStore } = createStore('fn-actions', () => {
      const [count, setCount] = useState(0)
      const [other, setOther] = useState(0)
      const increment = () => setCount(count + 1)   // a new closure on every store render
      return { count, other, increment, setOther }
    })
    let renders = 0
    const seen = new Set<unknown>()
    const Button = () => {
      renders++
      const { increment } = useStore()
      seen.add(increment)
      return <button data-testid="b" onClick={() => increment?.()} />
    }
    const { getByTestId } = render(<><AutoRootCtx /><Button /></>)
    await tick()
    const before = renders
    act(() => getStore().get().setOther!(1))
    act(() => getStore().get().setOther!(2))
    await tick()
    expect(renders).toBe(before)
    act(() => getByTestId('b').click())
    act(() => getByTestId('b').click())
    await tick()
    expect(getStore().get().count).toBe(2)          // each click ran the latest closure
    expect(renders).toBe(before)                    // calls from handlers never subscribe
    expect(seen.size).toBe(2)                       // undefined before the first publish, then one function
  })
})

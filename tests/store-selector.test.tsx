import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { Component, useState, type ReactNode } from 'react'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

type User = { name: string, email: string }
const useProfile = (_: {}) => {
  const [user, setUser] = useState<User>({ name: 'Ada', email: 'ada@example.com' })
  const [visits, setVisits] = useState(0)
  return { user, setUser, visits, bump: () => setVisits(v => v + 1) }
}

describe('useStore(params, selector)', () => {
  it('re-renders only when the selected (deep) value changes', async () => {
    const { useStore, getStore } = createStore('selector-deep', useProfile)
    let renders = 0
    const Name = () => {
      renders++
      const name = useStore({}, s => s.user?.name)
      return <span data-testid="name">{name}</span>
    }
    const { getByTestId } = render(<><AutoRootCtx /><Name /></>)
    await tick()
    expect(getByTestId('name').textContent).toBe('Ada')
    const after = renders

    // unrelated key
    await act(async () => { getStore().get().bump!() })
    expect(renders).toBe(after)

    // same name, new user object
    await act(async () => { getStore().get().setUser!({ name: 'Ada', email: 'new@example.com' }) })
    expect(renders).toBe(after)

    // name changes
    await act(async () => { getStore().get().setUser!({ name: 'Grace', email: 'new@example.com' }) })
    expect(getByTestId('name').textContent).toBe('Grace')
    expect(renders).toBeGreaterThan(after)
  })

  it('supports a custom equality for derived objects and inline selectors', async () => {
    const { useStore, getStore } = createStore('selector-eq', useProfile)
    const shallow = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i])
    let renders = 0
    const Initials = () => {
      renders++
      // new selector function every render, new array every call
      const parts = useStore({}, s => (s.user?.name ?? '').split(''), shallow)
      return <span data-testid="p">{parts.join('-')}</span>
    }
    const { getByTestId } = render(<><AutoRootCtx /><Initials /></>)
    await tick()
    expect(getByTestId('p').textContent).toBe('A-d-a')
    const after = renders
    await act(async () => { getStore().get().bump!() })
    await act(async () => { getStore().get().setUser!({ name: 'Ada', email: 'x' }) })
    expect(renders).toBe(after)
  })

  it('works without params and sees initialState on the first render', async () => {
    const { useStore } = createStore('selector-noparams', useProfile, {
      initialState: { visits: 100 },
    })
    const first: number[] = []
    const Visits = () => {
      const visits = useStore(undefined, s => s.visits)
      if (first.length === 0) first.push(visits)
      return <span data-testid="v">{visits}</span>
    }
    const { getByTestId } = render(<><AutoRootCtx /><Visits /></>)
    expect(first).toEqual([100])
    await tick()
    expect(getByTestId('v').textContent).toBe('0')
  })
})

class Catch extends Component<{ children?: ReactNode, onError: (error: unknown) => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { this.props.onError(error) }
  render() { return this.state.failed ? null : this.props.children }
}

describe('useStore call sites', () => {
  it('a call site that switches between a selector and none gets a clear error in development', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { useStore } = createStore('selector-switch', () => ({ count: 1 }))
    // plain JavaScript, or a non-null assertion on an optional selector: TypeScript rejects `undefined`
    const View = ({ select }: { select: boolean }) => {
      const value = (useStore as Function)(undefined, select ? (s: { count?: number }) => s.count : undefined)
      return <span>{typeof value}</span>
    }
    const caught: unknown[] = []
    const tree = (select: boolean) => <><AutoRootCtx /><Catch onError={e => caught.push(e)}><View select={select} /></Catch></>
    const { rerender } = render(tree(false))
    await tick()
    rerender(tree(true))
    await tick()
    expect(String(caught[0])).toMatch(/useStore\("selector-switch"\) was called with a selector/)
    errors.mockRestore()
  })
})


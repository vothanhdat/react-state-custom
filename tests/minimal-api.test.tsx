// The API that 2.0 keeps: createStore -> { useStore, storeRef }, useMultipleStore, AutoRootCtx, and
// the `select` option. Every test renders under StrictMode (tests/setup.ts).
import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { useEffect, useRef, useState } from 'react'
import { createStore, useMultipleStore, AutoRootCtx } from '../src'
import { StateScopeProvider } from '../src/state-utils/createAutoCtx'
import { frame } from '../src/schedulers'
import { flushScheduled } from '../src/testing'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

let names = 0

/** A store per id with a label and an unrelated counter; `running` holds the ids of the running instances. */
const itemStore = (options: { timeToClean?: number } = {}) => {
  const running = new Set<string>()
  const store = createStore(`minimal-item-${++names}`, ({ id }: { id: string }) => {
    const [label, setLabel] = useState(id.toUpperCase())
    const [hits, setHits] = useState(0)
    useEffect(() => {
      running.add(id)
      return () => { running.delete(id) }
    }, [id])
    return { label, setLabel, hits, hit: () => setHits(h => h + 1) }
  }, options)
  return { ...store, running }
}

/** Commits of a component: StrictMode renders twice, so count the effects of distinct renders. */
const useCommits = () => {
  const commits = useRef({ count: 0, last: undefined as object | undefined })
  const render = {}
  useEffect(() => {
    if (commits.current.last === render) return
    commits.current.last = render
    commits.current.count++
  })
  return commits.current
}

describe('storeRef(params)', () => {
  it('reads, subscribes to and keeps running one instance', async () => {
    const { storeRef, running } = itemStore()
    const ref = storeRef({ id: 'a' })
    expect(ref.name).toMatch(/^minimal-item-\d+\?id=a$/)
    render(<AutoRootCtx />)
    let release = () => { }
    act(() => { release = ref.retain() })
    await tick()
    expect(ref.ready).toBe(true)
    expect(running.has('a')).toBe(true)
    expect(ref.get().label).toBe('A')

    const seen: (string | undefined)[] = []
    const unsubscribe = ref.subscribe(state => { seen.push(state.label) })
    await act(async () => { ref.get().setLabel!('Alpha') })
    expect(seen).toContain('Alpha')
    unsubscribe()

    act(() => { release() })
    await tick()
    expect(running.has('a')).toBe(false)
  })

  // 1.x only: removed in 2.0
  it('is what getStore returned, under its new name', () => {
    const { storeRef, getStore } = itemStore()
    expect(getStore({ id: 'a' }).name).toBe(storeRef({ id: 'a' }).name)
  })
})

describe('useStore(params, { select })', () => {
  it('returns the selection and re-renders only when it changes, shallowly by default', async () => {
    const { useStore, storeRef } = createStore(`minimal-select-${++names}`, (_: {}) => {
      const [tags, setTags] = useState(['a', 'b'])
      const [hits, setHits] = useState(0)
      return { tags, setTags, hits, hit: () => setHits(h => h + 1) }
    })
    let commits = { count: 0 }
    const Tags = () => {
      commits = useCommits()
      // a fresh array on every call: equal by shallowEqual, not by Object.is
      const tags = useStore(undefined, { select: s => (s.tags ?? []).map(tag => tag.toUpperCase()) })
      return <span data-testid="tags">{tags.join(',')}</span>
    }
    const { getByTestId } = render(<><AutoRootCtx /><Tags /></>)
    await tick()
    expect(getByTestId('tags').textContent).toBe('A,B')
    const settled = commits.count

    await act(async () => { storeRef().get().hit!() })
    await act(async () => { storeRef().get().setTags!(['a', 'b']) })
    expect(commits.count).toBe(settled)

    await act(async () => { storeRef().get().setTags!(['a', 'c']) })
    expect(getByTestId('tags').textContent).toBe('A,C')
    expect(commits.count).toBe(settled + 1)
  })

  it('takes isEqual and schedule next to select', async () => {
    const { useStore, storeRef } = itemStore()
    const Label = () => {
      const label = useStore({ id: 'a' }, {
        select: s => s.label ?? '',
        // only the length counts
        isEqual: (a, b) => a.length === b.length,
        schedule: frame(),
      })
      return <span data-testid="label">{label}</span>
    }
    const { getByTestId } = render(<><AutoRootCtx /><Label /></>)
    await tick()
    expect(getByTestId('label').textContent).toBe('A')

    await act(async () => { storeRef({ id: 'a' }).get().setLabel!('B') })
    act(() => { flushScheduled() })
    expect(getByTestId('label').textContent).toBe('A')

    await act(async () => { storeRef({ id: 'a' }).get().setLabel!('Beta') })
    expect(getByTestId('label').textContent).toBe('A')
    act(() => { flushScheduled() })
    expect(getByTestId('label').textContent).toBe('Beta')
  })

  it('says where the options go when they are passed as params', () => {
    const { useStore } = itemStore()
    const error = vi.spyOn(console, 'error').mockImplementation(() => { })
    const Wrong = () => <>{String(useStore({ select: (s: { label?: string }) => s.label } as never))}</>
    expect(() => render(<><AutoRootCtx /><Wrong /></>)).toThrow(/got \{ select \} as its params\. Options come after the params/)
    error.mockRestore()
  })
})

describe('useMultipleStore(refs)', () => {
  it('reads one instance per ref, each started and shared as with useStore', async () => {
    const { storeRef, useStore, running } = itemStore()
    const Labels = ({ ids }: { ids: string[] }) => {
      const items = useMultipleStore(ids.map(id => storeRef({ id })))
      return <span data-testid="labels">{items.map(item => item.label ?? '…').join(',')}</span>
    }
    const One = () => <i data-testid="one">{useStore({ id: 'a' }).label}</i>
    const { getByTestId } = render(<><AutoRootCtx /><Labels ids={['a', 'b']} /><One /></>)
    await tick()
    expect(getByTestId('labels').textContent).toBe('A,B')
    expect([...running].sort()).toEqual(['a', 'b'])

    // the instance is shared: a change through one reader reaches the other
    await act(async () => { storeRef({ id: 'a' }).get().setLabel!('Alpha') })
    expect(getByTestId('labels').textContent).toBe('Alpha,B')
    expect(getByTestId('one').textContent).toBe('Alpha')
  })

  it('follows a list that changes length: new instances start, dropped ones stop', async () => {
    const { storeRef, running } = itemStore()
    const Labels = ({ ids }: { ids: string[] }) => {
      const items = useMultipleStore(ids.map(id => storeRef({ id })))
      return <span data-testid="labels">{items.map(item => item.label ?? '…').join(',')}</span>
    }
    const { getByTestId, rerender, unmount } = render(<><AutoRootCtx /><Labels ids={['a']} /></>)
    await tick()
    expect(getByTestId('labels').textContent).toBe('A')

    rerender(<><AutoRootCtx /><Labels ids={['a', 'b', 'c']} /></>)
    await tick()
    expect(getByTestId('labels').textContent).toBe('A,B,C')
    expect([...running].sort()).toEqual(['a', 'b', 'c'])

    rerender(<><AutoRootCtx /><Labels ids={['c']} /></>)
    await tick()
    expect(getByTestId('labels').textContent).toBe('C')
    expect([...running]).toEqual(['c'])

    unmount()
    await tick()
    expect(running.size).toBe(0)
  })

  it('re-renders only for the keys each proxy read', async () => {
    const { storeRef } = itemStore()
    let commits = { count: 0 }
    const Labels = () => {
      commits = useCommits()
      const [a, b] = useMultipleStore([storeRef({ id: 'a' }), storeRef({ id: 'b' })])
      return <span data-testid="labels">{a.label},{b.label}</span>
    }
    const { getByTestId } = render(<><AutoRootCtx /><Labels /></>)
    await tick()
    const settled = commits.count

    await act(async () => { storeRef({ id: 'a' }).get().hit!() })
    expect(commits.count).toBe(settled)

    await act(async () => { storeRef({ id: 'b' }).get().setLabel!('Beta') })
    expect(getByTestId('labels').textContent).toBe('A,Beta')
    expect(commits.count).toBe(settled + 1)
  })

  it('reads instances of different stores, typed by position', async () => {
    const items = itemStore()
    const { storeRef: userRef } = createStore(`minimal-user-${++names}`, (_: {}) => ({ name: 'Ada' }))
    const Line = () => {
      const [user, item] = useMultipleStore([userRef(), items.storeRef({ id: 'x' })])
      const name: string | undefined = user.name
      const label: string | undefined = item.label
      return <span data-testid="line">{name} {label}</span>
    }
    const { getByTestId } = render(<><AutoRootCtx /><Line /></>)
    await tick()
    expect(getByTestId('line').textContent).toBe('Ada X')
  })

  it('with select, returns the selection over every state and re-renders only when it changes', async () => {
    const { storeRef } = itemStore()
    let totalCommits = { count: 0 }
    let labelCommits = { count: 0 }
    const Total = ({ ids }: { ids: string[] }) => {
      totalCommits = useCommits()
      const total = useMultipleStore(ids.map(id => storeRef({ id })), {
        select: states => states.reduce((sum, state) => sum + (state.hits ?? 0), 0),
      })
      return <span data-testid="total">{total}</span>
    }
    const Labels = ({ ids }: { ids: string[] }) => {
      labelCommits = useCommits()
      // a fresh array with the same items: equal by the default shallowEqual
      const labels = useMultipleStore(ids.map(id => storeRef({ id })), { select: states => states.map(state => state.label) })
      return <span data-testid="labels">{labels.join(',')}</span>
    }
    const App = ({ ids }: { ids: string[] }) => <><AutoRootCtx /><Total ids={ids} /><Labels ids={ids} /></>
    const { getByTestId, rerender } = render(<App ids={['a', 'b']} />)
    await tick()
    expect(getByTestId('total').textContent).toBe('0')
    expect(getByTestId('labels').textContent).toBe('A,B')
    const total = totalCommits.count
    const labels = labelCommits.count

    await act(async () => { storeRef({ id: 'b' }).get().hit!() })
    expect(getByTestId('total').textContent).toBe('1')
    expect(totalCommits.count).toBe(total + 1)
    expect(labelCommits.count).toBe(labels)

    await act(async () => { storeRef({ id: 'a' }).get().setLabel!('Alpha') })
    expect(getByTestId('labels').textContent).toBe('Alpha,B')
    expect(labelCommits.count).toBe(labels + 1)
    expect(totalCommits.count).toBe(total + 1)

    rerender(<App ids={['a', 'b', 'c']} />)
    await tick()
    expect(getByTestId('labels').textContent).toBe('Alpha,B,C')
  })

  it('applies a schedule to every instance it reads', async () => {
    const { storeRef } = itemStore()
    const Labels = () => {
      const items = useMultipleStore([storeRef({ id: 'a' }), storeRef({ id: 'b' })], { schedule: frame() })
      return <span data-testid="labels">{items.map(item => item.label).join(',')}</span>
    }
    const { getByTestId } = render(<><AutoRootCtx /><Labels /></>)
    await tick()
    // the first data is not scheduled
    expect(getByTestId('labels').textContent).toBe('A,B')

    await act(async () => {
      storeRef({ id: 'a' }).get().setLabel!('Alpha')
      storeRef({ id: 'b' }).get().setLabel!('Beta')
    })
    expect(getByTestId('labels').textContent).toBe('A,B')
    act(() => { flushScheduled() })
    expect(getByTestId('labels').textContent).toBe('Alpha,Beta')
  })

  // 1.x only: removed in 2.0, with scopes
  it('reads the instances of the scope it renders in', async () => {
    const { storeRef, useStore } = itemStore()
    const Rename = () => {
      const { setLabel } = useStore({ id: 'a' })
      useEffect(() => { setLabel?.('Scoped') }, [setLabel])
      return null
    }
    const Label = ({ testId }: { testId: string }) => {
      const [item] = useMultipleStore([storeRef({ id: 'a' })])
      return <span data-testid={testId}>{item.label}</span>
    }
    const { getByTestId } = render(<>
      <AutoRootCtx />
      <Label testId="global" />
      <StateScopeProvider><Rename /><Label testId="scoped" /></StateScopeProvider>
    </>)
    await tick()
    expect(getByTestId('global').textContent).toBe('A')
    expect(getByTestId('scoped').textContent).toBe('Scoped')
  })

  it('works inside a store hook, over a list of instances', async () => {
    const { storeRef } = itemStore()
    const { useStore: useTotal } = createStore(`minimal-total-${++names}`, ({ ids }: { ids: string }) => {
      const states = useMultipleStore(ids.split(',').map(id => storeRef({ id })))
      return { labels: states.map(state => state.label ?? '…').join('+') }
    })
    const Total = () => <span data-testid="total">{useTotal({ ids: 'a,b' }).labels}</span>
    const { getByTestId } = render(<><AutoRootCtx /><Total /></>)
    await tick()
    expect(getByTestId('total').textContent).toBe('A+B')
    await act(async () => { storeRef({ id: 'b' }).get().setLabel!('Beta') })
    await tick()
    expect(getByTestId('total').textContent).toBe('A+Beta')
  })

  it('throws for an item that is not a store ref', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => { })
    const Wrong = () => <>{useMultipleStore([{ name: 'x' } as never]).length}</>
    expect(() => render(<><AutoRootCtx /><Wrong /></>)).toThrow(/refs\[0\] is not a store ref/)
    error.mockRestore()
  })
})

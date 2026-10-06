// Type-level tests, checked by `yarn typecheck` (tsc), never run.
import { useState } from 'react'
import { createStore, useMultipleStore, type Store, type StoreRef, type StoreState, type UseStore } from '../../src'
import { scheduled, useFrameState, sync, frame, throttle, debounce, idle, type Scheduler } from '../../src/schedulers'

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
const expectType = <T>(_value: T) => { }
const assert = <T extends true>() => { }

// State and params declared as interfaces, as many codebases do
interface CounterState { count: number; increment: () => void }
interface CounterParams { initial: number }

const useCounter = ({ initial }: CounterParams): CounterState => {
  const [count, setCount] = useState(initial)
  return { count, increment: () => setCount(c => c + 1) }
}
export const interfaces = createStore('types-interfaces', useCounter)
export const InterfaceConsumer = () => {
  const { count, increment } = interfaces.useStore({ initial: 1 })
  expectType<number | undefined>(count)
  expectType<(() => void) | undefined>(increment)
  // @ts-expect-error params are required
  interfaces.useStore()
  return null
}

// Type aliases keep working; every key is optional until the store has run
type TodoParams = { listId: string; page?: number }
type TodoState = { items: string[] }
export const aliases = createStore('types-aliases', (_: TodoParams): TodoState => ({ items: [] }))
export const AliasConsumer = () => {
  const { items } = aliases.useStore({ listId: 'a' })
  assert<Equals<typeof items, string[] | undefined>>()
  // default at the read
  const { items: list = [] } = aliases.useStore({ listId: 'a' })
  assert<Equals<typeof list, string[]>>()
  return null
}

// A hook without params is consumed without arguments
export const noParams = createStore('types-no-params', () => ({ n: 1 }))
export const NoParamsConsumer = () => {
  const { n } = noParams.useStore()
  expectType<number | undefined>(n)
  const doubled = noParams.useStore(undefined, { select: s => (s.n ?? 0) * 2 })
  expectType<number>(doubled)
  return null
}

// Optional params only: the argument may be omitted
export const optional = createStore('types-optional', ({ initial = 0 }: { initial?: number }) => ({ initial }))
export const OptionalConsumer = () => {
  optional.useStore()
  optional.useStore({ initial: 2 })
  optional.useStore(undefined, { select: s => s.initial })
  optional.storeRef()
  return null
}

// Required params are required by every form
export const required = createStore('types-required', ({ id }: { id: string }) => ({ name: id }))
export const RequiredConsumer = () => {
  required.useStore({ id: 'a' }, { select: s => s.name })
  // @ts-expect-error params are required
  required.useStore()
  // @ts-expect-error params are required with a selector too
  required.useStore(undefined, { select: s => s.name })
  // @ts-expect-error and by storeRef
  required.storeRef()
  return null
}

// Params must be primitives
interface User { id: string }
// @ts-expect-error an object is not a valid param value
createStore('types-object-param', ({ user }: { user: User }) => ({ id: user.id }))
// @ts-expect-error an interface with an object value is rejected as well
createStore('types-object-param-interface', ({ user }: { user: User } & CounterParams) => ({ id: user.id }))

// The hook returns an object of keys
// @ts-expect-error a tuple: return { count, setCount }
createStore('types-tuple', () => useState(0))
// @ts-expect-error an array
createStore('types-array', () => [1, 2])
// @ts-expect-error a function
createStore('types-function', () => () => 1)

// The options take timeToClean and schedule, nothing else
createStore('types-options', () => ({ n: 1 }), { timeToClean: 5000, schedule: frame() })
// @ts-expect-error removed in 2.0: default at the read
createStore('types-initial-state', () => ({ n: 1 }), { initialState: { n: 0 } })
// @ts-expect-error removed in 2.0: put the effect in the store hook
createStore('types-attached', () => ({ n: 1 }), { AttachedComponent: () => null })
// @ts-expect-error the options are an object
createStore('types-number', () => ({ n: 1 }), 5000)
// @ts-expect-error the hook receives its params only
createStore('types-pre-state', (_: {}, preState: { n?: number }) => ({ n: preState.n ?? 0 }))

// Read options: a schedule for the proxy; select, isEqual and a schedule for a selection
export const scheduledReads = createStore('types-schedule', () => ({ n: 1, ids: ['a'] }), { schedule: frame() })
export const ScheduledConsumer = () => {
  const { n } = scheduledReads.useStore(undefined, { schedule: throttle(100) })
  expectType<number | undefined>(n)
  const ids = scheduledReads.useStore(undefined, { select: s => s.ids ?? [], schedule: frame() })
  assert<Equals<typeof ids, string[]>>()
  const count = scheduledReads.useStore(undefined, { select: s => s.ids?.length ?? 0, schedule: debounce(50, { maxWait: 500 }) })
  assert<Equals<typeof count, number>>()
  // isEqual is typed by what select returns
  scheduledReads.useStore(undefined, { select: s => s.n, isEqual: (a, b) => expectType<number | undefined>(a) === expectType<number | undefined>(b) })
  // @ts-expect-error a schedule comes from a factory
  scheduledReads.useStore(undefined, { schedule: 'frame' })
  scheduledReads.useStore(undefined, { schedule: sync() })
  // @ts-expect-error isEqual compares selections
  scheduledReads.useStore(undefined, { select: s => s.n, isEqual: (a: string, b: string) => a === b })
  // @ts-expect-error the selector goes in the options
  scheduledReads.useStore(s => s.n)
  // @ts-expect-error the selector goes in the options
  scheduledReads.useStore(undefined, s => s.n)
  return null
}
export const RequiredScheduledConsumer = () => {
  required.useStore({ id: 'a' }, { schedule: frame() })
  required.useStore({ id: 'a' }, { select: s => s.name, schedule: idle(500) })
  return null
}

// scheduled keeps the arguments of the function
export const scheduledFn = scheduled((id: string, n: number) => { void id; void n }, frame())
scheduledFn('a', 1)
// @ts-expect-error arguments are checked
scheduledFn(1)
scheduledFn.cancel()
scheduledFn.flush()

// useFrameState is typed like useState
export const FrameStateConsumer = () => {
  const [n, setN] = useFrameState(0)
  assert<Equals<typeof n, number>>()
  setN(m => m + 1)
  const [maybe] = useFrameState<string>()
  assert<Equals<typeof maybe, string | undefined>>()
  // a scheduler of your own
  const everySecondFrame: Scheduler = { name: 'everySecondFrame', task: run => ({ request: run, cancel: () => { } }) }
  void everySecondFrame
  return null
}

// storeRef(params) and useMultipleStore(refs)

const items = createStore('types-items', ({ id }: { id: string }) => ({ label: id, hits: 0, hit: () => { } }))
const user = createStore('types-user', () => ({ name: 'Ada' }))

export const SelectOption = () => {
  const label = items.useStore({ id: 'a' }, { select: s => s.label ?? '' })
  assert<Equals<typeof label, string>>()
  // a store without params takes undefined there
  const name = user.useStore(undefined, { select: s => s.name })
  assert<Equals<typeof name, string | undefined>>()
  // without select, the options take a schedule only
  const proxy = items.useStore({ id: 'a' }, { schedule: frame() })
  expectType<string | undefined>(proxy.label)
  return null
}

export const Refs = () => {
  const ref = items.storeRef({ id: 'a' })
  expectType<StoreRef<{ label: string, hits: number, hit: () => void }>>(ref)
  expectType<string | undefined>(ref.get().label)
  assert<Equals<ReturnType<typeof ref.get>, StoreState<{ label: string, hits: number, hit: () => void }>>>()
  ref.subscribe((state, key) => {
    expectType<number | undefined>(state.hits)
    assert<Equals<typeof key, 'label' | 'hits' | 'hit'>>()
  })
  const release: () => void = ref.retain()
  void release
  expectType<boolean>(ref.ready)
  expectType<unknown>(ref.error)

  // typed by position
  const [u, i] = useMultipleStore([user.storeRef(), items.storeRef({ id: 'a' })])
  assert<Equals<typeof u.name, string | undefined>>()
  assert<Equals<typeof i.hits, number | undefined>>()
  // @ts-expect-error a tuple of two
  useMultipleStore([user.storeRef(), items.storeRef({ id: 'a' })])[2]

  // a list of any length
  const list = useMultipleStore(['a', 'b'].map(id => items.storeRef({ id })))
  expectType<(string | undefined)[]>(list.map(item => item.label))

  // select over every state
  const total = useMultipleStore(['a', 'b'].map(id => items.storeRef({ id })), { select: states => states.reduce((sum, s) => sum + (s.hits ?? 0), 0) })
  assert<Equals<typeof total, number>>()
  const both = useMultipleStore([user.storeRef(), items.storeRef({ id: 'a' })], { select: ([u, i]) => `${u.name} ${i.label}` })
  assert<Equals<typeof both, string>>()

  // @ts-expect-error only refs
  useMultipleStore([{ name: 'x' }])
  return null
}

// What createStore returns, as a type
export const typed: Store<{ id: string }, { label: string, hits: number, hit: () => void }> = items
// @ts-expect-error a different state
export const mistyped: Store<{ id: string }, { label: number }> = items
// The type of a store's useStore, for a wrapper that takes one
export const useItemsHook: UseStore<{ id: string }, { label: string, hits: number, hit: () => void }> = items.useStore
export const LabelOf = ({ useLabel }: { useLabel: UseStore<{ id: string }, { label: string }> }) => {
  const label = useLabel({ id: 'a' }, { select: s => s.label ?? '' })
  assert<Equals<typeof label, string>>()
  return null
}

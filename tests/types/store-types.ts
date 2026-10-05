// Type-level tests, checked by `yarn typecheck` (tsc), never run.
import { useState } from 'react'
import { createStore, createRootCtx, createAutoCtx, scheduled, shallowEqual, useFrameState, type Schedule, type StoreStatus } from '../../src'

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

// Type aliases keep working
type TodoParams = { listId: string; page?: number }
type TodoState = { items: string[] }
export const aliases = createStore('types-aliases', (_: TodoParams): TodoState => ({ items: [] }), {
  initialState: { items: [] },
})
export const AliasConsumer = () => {
  const { items } = aliases.useStore({ listId: 'a' })
  assert<Equals<typeof items, string[]>>()
  return null
}

// A hook without params is consumed without arguments
export const noParams = createStore('types-no-params', () => ({ n: 1 }))
export const NoParamsConsumer = () => {
  const { n } = noParams.useStore()
  expectType<number | undefined>(n)
  const doubled = noParams.useStore(undefined, s => (s.n ?? 0) * 2)
  expectType<number>(doubled)
  return null
}

// Optional params only: the argument may be omitted
export const optional = createStore('types-optional', ({ initial = 0 }: { initial?: number }) => ({ initial }))
export const OptionalConsumer = () => {
  optional.useStore()
  optional.useStore({ initial: 2 })
  optional.useStore(undefined, s => s.initial)
  return null
}

// Required params are required by every form, the selector form included
export const required = createStore('types-required', ({ id }: { id: string }) => ({ name: id }))
export const RequiredConsumer = () => {
  required.useStore({ id: 'a' }, s => s.name)
  // @ts-expect-error params are required
  required.useStore()
  // @ts-expect-error params are required with a selector too
  required.useStore(undefined, s => s.name)
  // @ts-expect-error params are required by useStoreSuspense
  required.useStoreSuspense()
  // @ts-expect-error params are required by useStoreStatus
  required.useStoreStatus()
  const status = required.useStoreStatus({ id: 'a' })
  assert<Equals<typeof status, StoreStatus>>()
  // @ts-expect-error params are required by the key form too
  required.useStoreSuspense(undefined, ['name'])
  return null
}

// useStoreSuspense(params, keys): the listed keys are present, the others as in useStore
export const keyed = createStore('types-keyed', () => ({ items: ['a'], add: (_: string) => { }, note: undefined as string | undefined, owner: null as string | null }), {
  initialState: { owner: null },
})
export const KeyedConsumer = () => {
  const s = keyed.useStoreSuspense(undefined, ['items', 'add'])
  assert<Equals<typeof s.items, string[]>>()
  assert<Equals<typeof s.add, (_: string) => void>>()
  assert<Equals<typeof s.owner, string | null>>()           // seeded
  assert<Equals<typeof s.note, string | undefined>>()       // neither listed nor seeded
  // @ts-expect-error not a key of the store
  keyed.useStoreSuspense(undefined, ['nope'])
  const listed = ['add'] as const
  const fromTuple = keyed.useStoreSuspense(undefined, listed) // a tuple kept in a variable
  assert<Equals<typeof fromTuple.add, (_: string) => void>>()
  // a widened array does not say which keys it holds: nothing beyond the seed is typed as present
  const wide: readonly ('items' | 'add')[] = ['items']
  const w = keyed.useStoreSuspense(undefined, wide)
  assert<Equals<typeof w.add, ((_: string) => void) | undefined>>()
  assert<Equals<typeof w.owner, string | null>>()
  const full = keyed.useStoreSuspense()
  assert<Equals<typeof full.items, string[]>>()             // the forms without keys are unchanged
  return null
}

// Params must be primitives
interface User { id: string }
// @ts-expect-error an object is not a valid param value
createStore('types-object-param', ({ user }: { user: User }) => ({ id: user.id }))
// @ts-expect-error an interface with an object value is rejected as well
createStore('types-object-param-interface', ({ user }: { user: User } & CounterParams) => ({ id: user.id }))

// The lower layers accept interfaces too
export const lower = createAutoCtx(createRootCtx('types-lower', useCounter))

// initialState: only the keys it holds are typed as present, and its values are checked against the
// store's types, so a literal needs no `as const`
type LoadStatus = 'loading' | 'ready' | 'error'
const useLoad = (_: { id: string }) => ({
  status: 'loading' as LoadStatus,
  ids: [] as string[],
  byId: {} as Record<string, number>,
  user: null as { name: string } | null,
  reload: () => { },
})
export const seededLiteral = createStore('types-seed-literal', useLoad, { initialState: { status: 'loading' } })
export const seededSeveral = createStore('types-seed-several', useLoad, { initialState: { status: 'ready', ids: [], byId: {} } })
export const seededByParams = createStore('types-seed-params', useLoad, {
  initialState: ({ id }) => ({ status: id ? 'loading' as const : 'error' as const }),
})
export const SeedConsumer = () => {
  const one = seededLiteral.useStore({ id: 'a' })
  assert<Equals<typeof one.status, LoadStatus>>()
  assert<Equals<typeof one.ids, string[] | undefined>>()            // not seeded: still optional
  assert<Equals<typeof one.reload, (() => void) | undefined>>()     // actions are never seeded
  const several = seededSeveral.useStore({ id: 'a' })
  assert<Equals<typeof several.ids, string[]>>()
  assert<Equals<typeof several.byId, Record<string, number>>>()
  assert<Equals<typeof several.user, { name: string } | null | undefined>>()
  const byParams = seededByParams.useStore({ id: 'a' })
  assert<Equals<typeof byParams.status, LoadStatus>>()
  assert<Equals<typeof byParams.ids, string[] | undefined>>()
  const handle = seededLiteral.getStore({ id: 'a' }).get()
  assert<Equals<typeof handle.status, LoadStatus>>()
  assert<Equals<typeof handle.ids, string[] | undefined>>()
  return null
}
// @ts-expect-error not a value of the store's type
createStore('types-seed-wrong-value', useLoad, { initialState: { status: 'done' } })
// @ts-expect-error not a key of the store
createStore('types-seed-wrong-key', useLoad, { initialState: { stauts: 'loading' } })
export const lowerSeeded = createAutoCtx(createRootCtx('types-lower-seeded', useLoad), { initialState: { status: 'loading' } })
export const LowerSeedConsumer = () => {
  const s = lowerSeeded.useStore({ id: 'a' })
  assert<Equals<typeof s.status, LoadStatus>>()
  assert<Equals<typeof s.ids, string[] | undefined>>()
  return null
}

// Read options: a schedule for the proxy, isEqual and a schedule for a selector, the selector first
// for a store without required params
export const scheduledReads = createStore('types-schedule', () => ({ n: 1, ids: ['a'] }), { schedule: 'frame' })
export const ScheduledConsumer = () => {
  const { n } = scheduledReads.useStore(undefined, { schedule: { throttle: 100 } })
  expectType<number | undefined>(n)
  const ids = scheduledReads.useStore(undefined, s => s.ids ?? [], { isEqual: shallowEqual, schedule: 'frame' })
  assert<Equals<typeof ids, string[]>>()
  const first = scheduledReads.useStore(s => s.ids?.[0])
  assert<Equals<typeof first, string | undefined>>()
  const count = scheduledReads.useStore(s => s.ids?.length ?? 0, { schedule: { debounce: 50, maxWait: 500 } })
  assert<Equals<typeof count, number>>()
  const same = scheduledReads.useStore(s => s.n, (a, b) => a === b)
  expectType<number | undefined>(same)
  // @ts-expect-error not a schedule
  scheduledReads.useStore(undefined, { schedule: 'later' })
  // @ts-expect-error isEqual compares selections
  scheduledReads.useStore(s => s.n, { isEqual: (a: string, b: string) => a === b })
  return null
}
export const RequiredScheduledConsumer = () => {
  required.useStore({ id: 'a' }, { schedule: 'frame' })
  required.useStore({ id: 'a' }, s => s.name, { schedule: { idle: 500 } })
  // @ts-expect-error the selector-first form needs a store without required params
  required.useStore(s => s.name)
  return null
}

// scheduled keeps the arguments of the function
export const scheduledFn = scheduled((id: string, n: number) => { void id; void n }, 'frame')
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
  const schedule: Schedule = { debounce: 10 }
  void schedule
  return null
}

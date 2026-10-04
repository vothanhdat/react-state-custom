// Type-level tests, checked by `yarn typecheck` (tsc), never run.
import { useState } from 'react'
import { createStore, createRootCtx, createAutoCtx, type StoreStatus } from '../../src'

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

// What `initialState` types as present, checked by `yarn tsc -p demos/task-manager`.
// Up to 1.6.0, `{ status: 'loading' }` (a string literal without `as const`) typed every key as
// present, actions included, so `ids.length` compiled although `ids` is undefined on the first
// render (initial-state-runtime.test.tsx). Now only the keys initialState holds are present.
import { useState } from 'react'
import { createStore } from '../../src'

const hook = () => {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [ids, setIds] = useState<string[]>([])
  return { status, ids, setStatus, setIds }
}
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
const assert = <T extends true>() => { }
type Present<R, K extends PropertyKey> = K extends keyof R ? {} extends Pick<R, K> ? 'optional' : 'present' : 'missing'
type Keys<R> = [Present<R, 'status'>, Present<R, 'ids'>, Present<R, 'setIds'>]

const literal = createStore('seed-literal', hook, { initialState: { status: 'loading' } })
const several = createStore('seed-several', hook, { initialState: { status: 'loading', ids: [] } })
const byParams = createStore('seed-function', hook, { initialState: () => ({ status: 'loading' as const }) }) // a function still needs `as const`
const unseeded = createStore('seed-none', hook)
const states = () => [literal.useStore(), several.useStore(), byParams.useStore(), unseeded.useStore()] as const
type S = ReturnType<typeof states>

assert<Equals<Keys<S[0]>, ['present', 'optional', 'optional']>>()
assert<Equals<Keys<S[1]>, ['present', 'present', 'optional']>>()
assert<Equals<Keys<S[2]>, ['present', 'optional', 'optional']>>()
assert<Equals<Keys<S[3]>, ['optional', 'optional', 'optional']>>()

export const ReadsUnseeded = () => {
  const { ids } = literal.useStore()
  // @ts-expect-error `ids` is not seeded, so it is possibly undefined
  return ids.length
}
// @ts-expect-error a value the hook never returns
createStore('seed-wrong-value', hook, { initialState: { status: 'done' } })

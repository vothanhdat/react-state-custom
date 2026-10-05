import { useState } from 'react'
import { createStore, type StoreState } from '../../src'
const hook = () => {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [ids, setIds] = useState<string[]>([])
  return { status, ids, setStatus, setIds }
}
// current signature
const cur = createStore('d', hook, { initialState: { status: 'loading' } })
export const Cur = () => { const { ids } = cur.useStore(); return ids.length }   // no error reported?

// candidate: a const type parameter
declare function withConst<U, V extends object, const I extends Partial<V> = {}>(
  name: string, useFn: (p: U, pre: Partial<V>) => V, o?: { initialState?: I | ((p: U) => I) }): { useStore(): StoreState<V, I> }
type Present<R, K extends keyof R> = {} extends Pick<R, K> ? 'optional' : 'present'
const cases = () => {
  const a = withConst('a', hook, { initialState: { status: 'loading', ids: [] } }).useStore()
  const b = withConst('b', hook, { initialState: { status: 'loading' } }).useStore()
  const c = withConst('c', hook, { initialState: { status: 'loading' as const, ids: [] as string[] } }).useStore()
  const d = withConst('d', hook, { initialState: () => ({ status: 'loading' }) }).useStore()
  const e = withConst('e', hook).useStore()
  const f = withConst('f', hook, { initialState: { ids: ['x'] } }).useStore()
  return [a, b, c, d, e, f] as const
}
type C = ReturnType<typeof cases>
export const show: 0 = null as unknown as [
  [Present<C[0], 'status'>, Present<C[0], 'ids'>, Present<C[0], 'setIds'>],
  [Present<C[1], 'status'>, Present<C[1], 'ids'>, Present<C[1], 'setIds'>],
  [Present<C[2], 'status'>, Present<C[2], 'ids'>, Present<C[2], 'setIds'>],
  [Present<C[3], 'status'>, Present<C[3], 'ids'>, Present<C[3], 'setIds'>],
  [Present<C[4], 'status'>, Present<C[4], 'ids'>, Present<C[4], 'setIds'>],
  [Present<C[5], 'status'>, Present<C[5], 'ids'>, Present<C[5], 'setIds'>],
]
// current signature, same probes
const curCases = () => [
  createStore('a2', hook, { initialState: { status: 'loading', ids: [] } }).useStore(),
  createStore('b2', hook, { initialState: { status: 'loading' } }).useStore(),
  createStore('c2', hook, { initialState: { status: 'loading' as const, ids: [] as string[] } }).useStore(),
  createStore('d2', hook, { initialState: () => ({ status: 'loading' }) }).useStore(),
] as const
type K = ReturnType<typeof curCases>
export const showCur: 0 = null as unknown as [
  [Present<K[0], 'status'>, Present<K[0], 'ids'>, Present<K[0], 'setIds'>],
  [Present<K[1], 'status'>, Present<K[1], 'ids'>, Present<K[1], 'setIds'>],
  [Present<K[2], 'status'>, Present<K[2], 'ids'>, Present<K[2], 'setIds'>],
  [Present<K[3], 'status'>, Present<K[3], 'ids'>, Present<K[3], 'setIds'>],
]

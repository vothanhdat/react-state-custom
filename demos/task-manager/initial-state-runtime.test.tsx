import React, { useState } from 'react'
import { render, act, cleanup } from '@testing-library/react'
import { AutoRootCtx, createStore } from '../../src'
import { resetStores } from '../../src/testing'
afterEach(() => { cleanup(); resetStores() })
it('a key typed present by the fallback is undefined on the first render', async () => {
  const { useStore } = createStore('rt', () => {
    const [status] = useState<'loading' | 'ready'>('loading')
    const [ids] = useState<string[]>(['a'])
    return { status, ids }
  }, { initialState: { status: 'loading' } })
  // @ts-ignore up to 1.6.0 this compiled: the literal 'loading' typed every key as seeded
  const C = () => { const { ids } = useStore(); return <p>{ids.length}</p> }
  let error: unknown
  try { render(<><AutoRootCtx /><C /></>); await act(async () => { }) } catch (e) { error = e }
  console.log('[rt]', String(error))
})

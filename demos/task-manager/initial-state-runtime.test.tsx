import React, { useState } from 'react'
import { render, act, cleanup } from '@testing-library/react'
import { AutoRootCtx, createStore, getContext } from '../../src'
afterEach(() => { cleanup(); getContext.cache.clear() })
it('a key typed present by the fallback is undefined on the first render', async () => {
  const { useStore } = createStore('rt', () => {
    const [status] = useState<'loading' | 'ready'>('loading')
    const [ids] = useState<string[]>(['a'])
    return { status, ids }
  }, { initialState: { status: 'loading' } })
  const C = () => { const { ids } = useStore(); return <p>{ids.length}</p> }   // compiles without an error
  let error: unknown
  try { render(<><AutoRootCtx /><C /></>); await act(async () => { }) } catch (e) { error = e }
  console.log('[rt]', String(error))
})

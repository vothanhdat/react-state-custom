import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import React, { Component, useEffect } from 'react'
import { createStore, AutoRootCtx } from '../src'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

afterEach(async () => {
  vi.restoreAllMocks()
  await act(() => new Promise(resolve => setTimeout(resolve, 150)))
})

class Catch extends Component<{ children: React.ReactNode }, { error?: unknown }> {
  state: { error?: unknown } = {}
  static getDerivedStateFromError(error: unknown) { return { error } }
  render() {
    return this.state.error !== undefined
      ? <b data-testid="caught">{String((this.state.error as Error).message)}</b>
      : this.props.children
  }
}

describe('a store hook that throws', () => {
  it('is disabled; storeRef().error reports what it threw while the instance lives', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => { })
    const { storeRef } = createStore('err-ref', () => {
      useEffect(() => { throw new Error('effect') }, [])
      return { v: 1 }
    })
    const { storeRef: otherRef } = createStore('err-ref-other', () => ({ ok: true }))
    render(<AutoRootCtx />)
    let releases: (() => void)[] = []
    act(() => { releases = [storeRef().retain(), otherRef().retain()] })
    await tick(50)
    expect((storeRef().error as Error).message).toBe('effect')
    expect(error.mock.calls.some(call => call.some(arg => (arg as Error)?.message === 'effect'))).toBe(true)
    // the other store keeps running
    expect(otherRef().get().ok).toBe(true)
    expect(otherRef().error).toBeUndefined()
    act(() => releases.forEach(release => release()))
    await tick(50)
    expect(storeRef().error).toBeUndefined()
  })
})

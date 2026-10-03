import React, { useState } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AutoRootCtx, StateScopeProvider, createStore, type StateDebugRenderer } from '../src'

const { useStore } = createStore('dbg-counter', ({ initial }: { initial: number }) => {
  const [count, setCount] = useState(initial)
  return { count, increment: () => setCount(c => c + 1) }
})

const Consumer = () => <span>{useStore({ initial: 3 }).count}</span>

describe('debugging prop', () => {
  it('true renders each store instance as JSON text tagged with its key', async () => {
    render(<><AutoRootCtx debugging /><Consumer /></>)
    const pre = await screen.findByText(/"count": 3/)
    expect(pre.tagName).toBe('PRE')
    expect(pre.getAttribute('data-store')).toBe('dbg-counter?initial=3')
    expect(pre.textContent).toContain('"increment": "ƒ increment()"')
  })

  it('accepts a custom renderer receiving the key and the state', async () => {
    const Debug: StateDebugRenderer = ({ name, value }) => <div data-testid="dbg">{name}={String(value.count)}</div>
    render(<><AutoRootCtx debugging={Debug} /><Consumer /></>)
    expect((await screen.findByTestId('dbg')).textContent).toBe('dbg-counter?initial=3=3')
  })

  it('is forwarded by StateScopeProvider', async () => {
    render(<StateScopeProvider debugging><Consumer /></StateScopeProvider>)
    expect((await screen.findByText(/"count": 3/)).getAttribute('data-store')).toBe('dbg-counter?initial=3')
  })

  it('renders nothing by default', async () => {
    const { container } = render(<><AutoRootCtx /><Consumer /></>)
    await screen.findByText('3')
    expect(container.querySelector('pre')).toBeNull()
  })
})

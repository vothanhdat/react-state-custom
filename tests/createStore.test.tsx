import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { createStore, AutoRootCtx } from '../src'
import { withRealTimers } from './utils'

describe('createStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('returns useStore and storeRef', () => {
    const store = createStore('store-test', () => {
      const [count] = React.useState(0)
      return { count }
    })

    expect(typeof store.useStore).toBe('function')
    expect(typeof store.storeRef).toBe('function')
  })

  it('should allow consuming state via useStore', async () => {
    const { useStore, storeRef } = createStore('store-consume-test', () => {
      const [count, setCount] = React.useState(10)
      const increment = () => setCount(c => c + 1)
      return { count, increment }
    })

    function Counter() {
      const { count, increment } = useStore()
      // a subscription next to the reader sees the same data
      const [manualCount, setManualCount] = React.useState<number | undefined>(undefined)
      React.useEffect(() => storeRef().subscribe(state => setManualCount(state.count)), [])

      return (
        <div>
          <div data-testid="count">{count}</div>
          <div data-testid="manual-count">{manualCount}</div>
          <button onClick={increment} data-testid="increment">Increment</button>
        </div>
      )
    }

    render(
      <>
        <AutoRootCtx />
        <Counter />
      </>
    )

    await withRealTimers(async () => {
      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('10')
      })

      fireEvent.click(screen.getByTestId('increment'))

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('11')
        expect(screen.getByTestId('manual-count').textContent).toBe('11')
      })
    })
  })

  it('should handle parameters in useStore', async () => {
    const { useStore, storeRef } = createStore('store-params-test', ({ id }: { id: string }) => {
      const [name] = React.useState(`User ${id}`)
      return { name }
    })

    function UserProfile({ id }: { id: string }) {
      const { name } = useStore({ id })
      return <div data-testid={`user-${id}`}>{name}</div>
    }

    render(
      <>
        <AutoRootCtx />
        <UserProfile id="1" />
        <UserProfile id="2" />
      </>
    )

    await withRealTimers(async () => {
      await waitFor(() => {
        expect(screen.getByTestId('user-1').textContent).toBe('User 1')
        expect(screen.getByTestId('user-2').textContent).toBe('User 2')
      })
      expect(storeRef({ id: '1' }).get().name).toBe('User 1')
      expect(storeRef({ id: '2' }).get().name).toBe('User 2')
    })
  })

  it('should support timeToClean', async () => {
    const { useStore, storeRef } = createStore('store-cleanup-test', () => {
      const [count, setCount] = React.useState(100)
      return { count, increment: () => setCount(c => c + 1) }
    }, { timeToClean: 100 })

    function App() {
      const { count } = useStore()
      return <div data-testid="count">{count}</div>
    }

    const { rerender } = render(
      <>
        <AutoRootCtx />
        <App />
      </>
    )

    await withRealTimers(async () => {
      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('100')
      })
      act(() => storeRef().get().increment!())

      rerender(<AutoRootCtx />)

      // less than timeToClean: the instance is still running
      await new Promise(r => setTimeout(r, 50))
      expect(storeRef().ready).toBe(true)

      rerender(
        <>
          <AutoRootCtx />
          <App />
        </>
      )

      // the same instance, with its state
      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('101')
      })

      rerender(<AutoRootCtx />)

      // past timeToClean: torn down
      await new Promise(r => setTimeout(r, 150))
      expect(storeRef().ready).toBe(false)
    })
  })
})

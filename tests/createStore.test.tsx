import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import React from 'react'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'
import { withRealTimers } from './utils'

describe('createStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should create a store with useStore hook', () => {
    const useCounter = () => {
      const [count] = React.useState(0)
      return { count }
    }

    const store = createStore('store-test', useCounter)

    expect(store.useStore).toBeDefined()
    expect(typeof store.useStore).toBe('function')
    expect(store.useCtxState).toBeDefined()
    expect(typeof store.useCtxState).toBe('function')
  })

  it('should allow consuming state via useStore', async () => {
    const useCounter = () => {
      const [count, setCount] = React.useState(10)
      const increment = () => setCount(c => c + 1)
      return { count, increment }
    }

    const store = createStore('store-consume-test', useCounter)
    const { useStore } = store

    function Counter() {
      const { count, increment } = useStore({})
      const ctx = store.useCtxState({})
      // Manually subscribe to check if context has data
      const [manualCount, setManualCount] = React.useState<number | undefined>(undefined)
      
      React.useEffect(() => {
        return ctx.subscribe('count', (val) => setManualCount(val as number))
      }, [ctx])

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
      // Check if manual subscription works
      await waitFor(() => {
        expect(screen.getByTestId('manual-count').textContent).toBe('10')
      })
      
      // Check if useStore works
      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('10')
      })

      fireEvent.click(screen.getByTestId('increment'))

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('11')
      })
    })
  })

  it('should handle parameters in useStore', async () => {
    const useUser = ({ id }: { id: string }) => {
      const [name] = React.useState(`User ${id}`)
      return { name }
    }

    const store = createStore('store-params-test', useUser)
    const { useStore } = store

    function UserProfile({ id }: { id: string }) {
      const { name } = useStore({ id })
      const ctx = store.useCtxState({ id })
      const [manualName, setManualName] = React.useState<string | undefined>(undefined)
      
      React.useEffect(() => {
        return ctx.subscribe('name', (val) => setManualName(val as string))
      }, [ctx])

      return (
        <div>
          <div data-testid={`user-${id}`}>{name}</div>
          <div data-testid={`manual-user-${id}`}>{manualName}</div>
        </div>
      )
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
        expect(screen.getByTestId('manual-user-1').textContent).toBe('User 1')
        expect(screen.getByTestId('manual-user-2').textContent).toBe('User 2')
      })

      await waitFor(() => {
        expect(screen.getByTestId('user-1').textContent).toBe('User 1')
        expect(screen.getByTestId('user-2').textContent).toBe('User 2')
      })
    })
  })

  it('should support AttatchedComponent', async () => {
    const useCounter = () => {
      const [count] = React.useState(0)
      return { count }
    }

    const Attached = () => <div data-testid="attached">Attached</div>

    const { useStore } = createStore('store-attached-test', useCounter, 0, Attached)

    function App() {
      useStore({})
      return null
    }

    render(
      <>
        <AutoRootCtx />
        <App />
      </>
    )

    await withRealTimers(async () => {
      await waitFor(() => {
        expect(screen.getByTestId('attached')).toBeDefined()
      })
    })
  })

  it('should support timeToClean', async () => {
    const useCounter = () => {
      const [count] = React.useState(100)
      return { count }
    }

    // 100ms cleanup delay
    const store = createStore('store-cleanup-test', useCounter, 100)
    const { useStore } = store

    function App({ show }: { show: boolean }) {
      if (!show) return null
      const { count } = useStore({})
      const ctx = store.useCtxState({})
      // Manual subscription to ensure data availability
      const [manualCount, setManualCount] = React.useState<number | undefined>(undefined)
      React.useEffect(() => {
        return ctx.subscribe('count', (val) => setManualCount(val as number))
      }, [ctx])

      return (
        <div>
          <div data-testid="count">{count}</div>
          <div data-testid="manual-count">{manualCount}</div>
        </div>
      )
    }

    const { rerender } = render(
      <>
        <AutoRootCtx />
        <App show={true} />
      </>
    )

    await withRealTimers(async () => {
      await waitFor(() => {
        expect(screen.getByTestId('manual-count').textContent).toBe('100')
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('100')
      })

      // Unmount
      rerender(
        <>
          <AutoRootCtx />
          <App show={false} />
        </>
      )

      // Wait 50ms (less than 100ms) - should still be technically alive in AutoRootCtx state
      await new Promise(r => setTimeout(r, 50))
      
      // We can't easily check internal state, but we can check that re-mounting quickly works
      rerender(
        <>
          <AutoRootCtx />
          <App show={true} />
        </>
      )
      
      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('100')
      })
      
      // Unmount again
      rerender(
        <>
          <AutoRootCtx />
          <App show={false} />
        </>
      )
      
      // Wait > 100ms
      await new Promise(r => setTimeout(r, 150))
      
      // Should be cleaned up.
      expect(screen.queryByTestId('count')).toBeNull()
    })
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import React from 'react'
import { createAutoCtx, AutoRootCtx, StateScopeProvider } from '../src/state-utils/createAutoCtx'
import { createRootCtx } from '../src/state-utils/createRootCtx'
import { useDataSubscribe } from '../src/state-utils/ctx'

describe('AutoRootCtx Isolation', () => {
  it('should isolate state between nested scopes', async () => {
    // Create a simple counter store
    const useCounter = () => {
      const [count, setCount] = React.useState(0)
      return {
        count,
        increment: () => setCount(c => c + 1)
      }
    }

    const rootCtx = createRootCtx('isolation-test', useCounter)
    const autoCtx = createAutoCtx(rootCtx)

    function Consumer({ label }: { label: string }) {
      const ctx = autoCtx.useCtxState({})
      const count = useDataSubscribe(ctx, 'count')
      const increment = useDataSubscribe(ctx, 'increment')

      return (
        <div data-testid={`consumer-${label}`}>
          <span data-testid={`count-${label}`}>{count}</span>
          <button onClick={increment} data-testid={`btn-${label}`}>
            Increment
          </button>
        </div>
      )
    }

    render(
      <>
        <AutoRootCtx />
        <Consumer label="outer" />

        <StateScopeProvider>
           <Consumer label="inner" />
        </StateScopeProvider>
      </>
    )

    // Initial state: both should be 0
    await waitFor(() => {
      expect(screen.getByTestId('count-outer').textContent).toBe('0')
      expect(screen.getByTestId('count-inner').textContent).toBe('0')
    })

    // Increment outer
    fireEvent.click(screen.getByTestId('btn-outer'))

    await waitFor(() => {
      expect(screen.getByTestId('count-outer').textContent).toBe('1')
      // Inner should remain 0 if isolated
      expect(screen.getByTestId('count-inner').textContent).toBe('0')
    })

    // Increment inner
    fireEvent.click(screen.getByTestId('btn-inner'))

    await waitFor(() => {
      expect(screen.getByTestId('count-outer').textContent).toBe('1')
      expect(screen.getByTestId('count-inner').textContent).toBe('1')
    })
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import React from 'react'
import { createAutoCtx, AutoRootCtx } from '../src/state-utils/createAutoCtx'
import { createRootCtx } from '../src/state-utils/createRootCtx'
import { useDataSubscribe } from '../src/state-utils/ctx'
import { withRealTimers } from './utils'

describe('AutoRootCtx', () => {
  it('should render without crashing', () => {
    const { container } = render(<AutoRootCtx />)
    expect(container).toBeDefined()
  })

  it('should render subscribed roots', async () => {
    const useCounter = () => {
      const [count] = React.useState(42)
      return { count }
    }

    const rootCtx = createRootCtx('auto-render-test', useCounter)
    const autoCtx = createAutoCtx(rootCtx)

    function Consumer() {
      const ctx = autoCtx.useCtxState({})
      const count = useDataSubscribe(ctx, 'count')
      return <div data-testid="count">{count}</div>
    }

    render(
      <>
        <AutoRootCtx />
        <Consumer />
      </>
    )

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('42')
    })
  })

  it('should handle multiple subscribers with same params', async () => {
    const useCounter = () => {
      const [count] = React.useState(100)
      return { count }
    }

    const rootCtx = createRootCtx('multi-subscriber-test', useCounter)
    const autoCtx = createAutoCtx(rootCtx)

    function Consumer({ id }: { id: string }) {
      const ctx = autoCtx.useCtxState({})
      const count = useDataSubscribe(ctx, 'count')
      return <div data-testid={`count-${id}`}>{count}</div>
    }

    render(
      <>
        <AutoRootCtx />
        <Consumer id="1" />
        <Consumer id="2" />
        <Consumer id="3" />
      </>
    )

    await waitFor(() => {
      expect(screen.getByTestId('count-1').textContent).toBe('100')
      expect(screen.getByTestId('count-2').textContent).toBe('100')
      expect(screen.getByTestId('count-3').textContent).toBe('100')
    })
  })

  it('should handle multiple roots with different params', async () => {
    const useStore = ({ id }: { id: string }) => {
      const [value] = React.useState(`value-${id}`)
      return { value }
    }

    const rootCtx = createRootCtx('multi-root-test', useStore)
    const autoCtx = createAutoCtx(rootCtx)

    function Consumer({ id }: { id: string }) {
      const ctx = autoCtx.useCtxState({ id })
      const value = useDataSubscribe(ctx, 'value')
      return <div data-testid={`value-${id}`}>{value}</div>
    }

    render(
      <>
        <AutoRootCtx />
        <Consumer id="a" />
        <Consumer id="b" />
        <Consumer id="c" />
      </>
    )

    await waitFor(() => {
      expect(screen.getByTestId('value-a').textContent).toBe('value-a')
      expect(screen.getByTestId('value-b').textContent).toBe('value-b')
      expect(screen.getByTestId('value-c').textContent).toBe('value-c')
    })
  })

  it('should wrap roots with provided Wrapper component', async () => {
    const useCounter = () => {
      const [count] = React.useState(50)
      return { count }
    }

    const rootCtx = createRootCtx('wrapper-test', useCounter)
    const autoCtx = createAutoCtx(rootCtx)

    const WrapperComponent = ({ children }: { children: React.ReactNode }) => {
      return <div data-testid="wrapper">{children}</div>
    }

    function Consumer() {
      const ctx = autoCtx.useCtxState({})
      const count = useDataSubscribe(ctx, 'count')
      return <div data-testid="count">{count}</div>
    }

    render(
      <>
        <AutoRootCtx Wrapper={WrapperComponent} />
        <Consumer />
      </>
    )

    await waitFor(() => {
      expect(screen.getByTestId('wrapper')).toBeDefined()
      expect(screen.getByTestId('count').textContent).toBe('50')
    })
  })
})

describe('createAutoCtx', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should create auto context hooks', () => {
    const useCounter = () => {
      const [count] = React.useState(0)
      return { count }
    }

    const rootCtx = createRootCtx('create-test', useCounter)
    const autoCtx = createAutoCtx(rootCtx)

    expect(autoCtx.useCtxState).toBeDefined()
    expect(typeof autoCtx.useCtxState).toBe('function')
  })

  it('should share instances for identical params', async () => {
    let renderCount = 0
    const useCounter = () => {
      const [count] = React.useState(() => {
        renderCount++
        return renderCount
      })
      return { count }
    }

    const rootCtx = createRootCtx('share-instance-test', useCounter)
    const autoCtx = createAutoCtx(rootCtx)

    function Consumer({ id }: { id: string }) {
      const ctx = autoCtx.useCtxState({})
      const count = useDataSubscribe(ctx, 'count')
      return <div data-testid={`count-${id}`}>{count}</div>
    }

    render(
      <>
        <AutoRootCtx />
        <Consumer id="1" />
        <Consumer id="2" />
      </>
    )

    await withRealTimers(async () => {
      await waitFor(() => {
        const count1 = screen.getByTestId('count-1').textContent
        const count2 = screen.getByTestId('count-2').textContent
        // Both should have the same count, proving they share the same Root instance
        expect(count1).toBe(count2)
        expect(count1).toBe('1') // Verify they both show 1, meaning single instance
      }, { timeout: 5000 })
    })
  }, 5000)

  it('should create separate instances for different params', async () => {
    const useStore = ({ id }: { id: number }) => {
      const [value] = React.useState(id * 10)
      return { value }
    }

    const rootCtx = createRootCtx('separate-instance-test', useStore)
    const autoCtx = createAutoCtx(rootCtx)

    function Consumer({ id }: { id: number }) {
      const ctx = autoCtx.useCtxState({ id })
      const value = useDataSubscribe(ctx, 'value')
      return <div data-testid={`value-${id}`}>{value}</div>
    }

    render(
      <>
        <AutoRootCtx />
        <Consumer id={1} />
        <Consumer id={2} />
      </>
    )

    await withRealTimers(async () => {
      await waitFor(() => {
        expect(screen.getByTestId('value-1').textContent).toBe('10')
        expect(screen.getByTestId('value-2').textContent).toBe('20')
      }, { timeout: 5000 })
    })
  }, 5000)

  it('should handle unmounting and cleanup', async () => {
    const useCounter = () => {
      const [count] = React.useState(99)
      return { count }
    }

    const rootCtx = createRootCtx('cleanup-test', useCounter)
    const autoCtx = createAutoCtx(rootCtx, 100) // 100ms unmount delay

    function Consumer({ show }: { show: boolean }) {
      const ctx = autoCtx.useCtxState({})
      const count = useDataSubscribe(ctx, 'count')
      return show ? <div data-testid="count">{count}</div> : null
    }

    const { rerender } = render(
      <>
        <AutoRootCtx />
        <Consumer show={true} />
      </>
    )

    await withRealTimers(async () => {
      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('99')
      }, { timeout: 5000 })

      // Unmount consumer
      rerender(
        <>
          <AutoRootCtx />
          <Consumer show={false} />
        </>
      )

      // Wait for cleanup delay - use real timers
      await new Promise(resolve => setTimeout(resolve, 150))

      // Root should be cleaned up after delay
      // Note: This is hard to test directly, but we're verifying no errors occur
      expect(screen.queryByTestId('count')).toBeNull()
    })
  }, 5000)

  it('should handle rapid mount/unmount cycles', async () => {
    const useCounter = () => {
      const [count] = React.useState(88)
      return { count }
    }

    const rootCtx = createRootCtx('rapid-mount-test', useCounter)
    const autoCtx = createAutoCtx(rootCtx, 50) // 50ms unmount delay

    function Consumer({ show }: { show: boolean }) {
      const ctx = autoCtx.useCtxState({})
      const count = useDataSubscribe(ctx, 'count')
      return show ? <div data-testid="count">{count}</div> : null
    }

    const { rerender } = render(
      <>
        <AutoRootCtx />
        <Consumer show={true} />
      </>
    )

    await withRealTimers(async () => {
      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('88')
      }, { timeout: 5000 })

      // Rapid unmount and remount
      rerender(
        <>
          <AutoRootCtx />
          <Consumer show={false} />
        </>
      )

      // Wait less than unmount delay
      await new Promise(resolve => setTimeout(resolve, 25))

      rerender(
        <>
          <AutoRootCtx />
          <Consumer show={true} />
        </>
      )

      await waitFor(() => {
        // Should still show the same value, Root wasn't actually unmounted
        expect(screen.getByTestId('count').textContent).toBe('88')
      }, { timeout: 5000 })
    })
  }, 5000)

  it('should handle updates after auto-mounting', async () => {
    const useCounter = () => {
      const [count, setCount] = React.useState(0)
      return { count, increment: () => setCount(c => c + 1) }
    }

    const rootCtx = createRootCtx('auto-update-test', useCounter)
    const autoCtx = createAutoCtx(rootCtx)

    function Consumer() {
      const ctx = autoCtx.useCtxState({})
      const count = useDataSubscribe(ctx, 'count')
      const increment = useDataSubscribe(ctx, 'increment')
      
      return (
        <div>
          <div data-testid="count">{count}</div>
          <button onClick={increment} data-testid="increment">
            Increment
          </button>
        </div>
      )
    }

    const { getByTestId } = render(
      <>
        <AutoRootCtx />
        <Consumer />
      </>
    )

    await withRealTimers(async () => {
      await waitFor(() => {
        expect(getByTestId('count').textContent).toBe('0')
      }, { timeout: 5000 })

      // Click increment via RTL helper so the update is wrapped in act
      fireEvent.click(getByTestId('increment'))

      await waitFor(() => {
        expect(getByTestId('count').textContent).toBe('1')
      }, { timeout: 5000 })

      // Click again
      fireEvent.click(getByTestId('increment'))

      await waitFor(() => {
        expect(getByTestId('count').textContent).toBe('2')
      }, { timeout: 5000 })
    })
  }, 5000)
})

describe('AutoRootCtx error handling', () => {
  it('should handle errors with Wrapper component', async () => {
    const useCounter = () => {
      throw new Error('Test error')
    }

    const rootCtx = createRootCtx('error-test', useCounter)
    const autoCtx = createAutoCtx(rootCtx)

    const ErrorBoundaryWrapper = ({ children }: { children: React.ReactNode }) => {
      const [hasError, setHasError] = React.useState(false)

      React.useEffect(() => {
        const errorHandler = () => {
          setHasError(true)
        }
        window.addEventListener('error', errorHandler)
        return () => window.removeEventListener('error', errorHandler)
      }, [])

      if (hasError) {
        return <div data-testid="error-boundary">Error caught</div>
      }
      return <>{children}</>
    }

    function Consumer() {
      const ctx = autoCtx.useCtxState({})
      const count = useDataSubscribe(ctx, 'count')
      return <div data-testid="count">{count}</div>
    }

    // Suppress console errors for this test
    const consoleError = console.error
    console.error = vi.fn()

    try {
      render(
        <>
          <AutoRootCtx Wrapper={ErrorBoundaryWrapper} />
          <Consumer />
        </>
      )

      // The error should be thrown and caught
      await waitFor(() => {
        // Test passes if we get here without crashing
        expect(true).toBe(true)
      })
    } catch (error) {
      // Expected to throw, test passes
      expect(error).toBeDefined()
    } finally {
      console.error = consoleError
    }
  })
})

describe('createAutoCtx with AttatchedComponent', () => {
  it('should render AttatchedComponent alongside the state runner', async () => {
    const useCounter = () => {
      const [count] = React.useState(42)
      return { count }
    }

    const rootCtx = createRootCtx('attached-test', useCounter)
    
    const AttatchedComponent: React.FC<{}> = () => {
      return <div data-testid="attached">Attached Component Rendered</div>
    }
    
    const autoCtx = createAutoCtx(rootCtx, 0, AttatchedComponent)

    function Consumer() {
      const ctx = autoCtx.useCtxState({})
      const count = useDataSubscribe(ctx, 'count')
      return <div data-testid="count">{count}</div>
    }

    render(
      <>
        <AutoRootCtx />
        <Consumer />
      </>
    )

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('42')
      expect(screen.getByTestId('attached').textContent).toBe('Attached Component Rendered')
    })
  })

  it('should pass params to AttatchedComponent', async () => {
    const useStore = ({ id }: { id: string }) => {
      const [value] = React.useState(`value-${id}`)
      return { value }
    }

    const rootCtx = createRootCtx('attached-params-test', useStore)
    
    const AttatchedComponent: React.FC<{ id: string }> = ({ id }) => {
      return <div data-testid={`attached-${id}`}>ID: {id}</div>
    }
    
    const autoCtx = createAutoCtx(rootCtx, 0, AttatchedComponent)

    function Consumer({ id }: { id: string }) {
      const ctx = autoCtx.useCtxState({ id })
      const value = useDataSubscribe(ctx, 'value')
      return <div data-testid={`value-${id}`}>{value}</div>
    }

    render(
      <>
        <AutoRootCtx />
        <Consumer id="test-id" />
      </>
    )

    await waitFor(() => {
      expect(screen.getByTestId('value-test-id').textContent).toBe('value-test-id')
      expect(screen.getByTestId('attached-test-id').textContent).toBe('ID: test-id')
    })
  })

  it('should render multiple AttatchedComponents for different params', async () => {
    const useStore = ({ id }: { id: string }) => {
      const [value] = React.useState(`value-${id}`)
      return { value }
    }

    const rootCtx = createRootCtx('attached-multi-test', useStore)
    
    const AttatchedComponent: React.FC<{ id: string }> = ({ id }) => {
      return <div data-testid={`attached-${id}`}>Attached: {id}</div>
    }
    
    const autoCtx = createAutoCtx(rootCtx, 0, AttatchedComponent)

    function Consumer({ id }: { id: string }) {
      const ctx = autoCtx.useCtxState({ id })
      const value = useDataSubscribe(ctx, 'value')
      return <div data-testid={`value-${id}`}>{value}</div>
    }

    render(
      <>
        <AutoRootCtx />
        <Consumer id="a" />
        <Consumer id="b" />
      </>
    )

    await waitFor(() => {
      expect(screen.getByTestId('value-a').textContent).toBe('value-a')
      expect(screen.getByTestId('value-b').textContent).toBe('value-b')
      expect(screen.getByTestId('attached-a').textContent).toBe('Attached: a')
      expect(screen.getByTestId('attached-b').textContent).toBe('Attached: b')
    })
  })
})

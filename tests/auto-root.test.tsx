import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { createStore, AutoRootCtx } from '../src'
import { withRealTimers } from './utils'

describe('AutoRootCtx', () => {
  it('should render without crashing', () => {
    const { container } = render(<AutoRootCtx />)
    expect(container).toBeDefined()
  })

  it('should render subscribed roots', async () => {
    const { useStore } = createStore('auto-render-test', () => {
      const [count] = React.useState(42)
      return { count }
    })

    function Consumer() {
      const { count } = useStore()
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
    const { useStore } = createStore('multi-subscriber-test', () => {
      const [count] = React.useState(100)
      return { count }
    })

    function Consumer({ id }: { id: string }) {
      const { count } = useStore()
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
    const { useStore } = createStore('multi-root-test', ({ id }: { id: string }) => {
      const [value] = React.useState(`value-${id}`)
      return { value }
    })

    function Consumer({ id }: { id: string }) {
      const { value } = useStore({ id })
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

  it('treats params with a different key order as the same instance', async () => {
    let started = 0
    const { useStore } = createStore('order-ctx', ({ a, b }: { a: number; b: number }) => {
      const [value] = React.useState(() => `${a}:${b}:${++started}`)
      return { value }
    })

    function Unordered() {
      const { value } = useStore({ b: 2, a: 1 })
      return <div data-testid="value-unordered">{value}</div>
    }

    function Ordered() {
      const { value } = useStore({ a: 1, b: 2 })
      return <div data-testid="value-ordered">{value}</div>
    }

    render(
      <>
        <AutoRootCtx />
        <Unordered />
        <Ordered />
      </>
    )

    await waitFor(() => expect(screen.getByTestId('value-unordered').textContent).toMatch(/^1:2:/))
    expect(screen.getByTestId('value-ordered').textContent).toBe(screen.getByTestId('value-unordered').textContent)
  })

  it('follows the instance of the new params when they change', async () => {
    const { useStore } = createStore('switch-ctx', ({ id }: { id: string }) => {
      const [value] = React.useState(id)
      return { value }
    })

    function Consumer() {
      const [id, setId] = React.useState('a')
      const { value } = useStore({ id })
      return <button data-testid="value" onClick={() => setId('b')}>{value}</button>
    }

    render(
      <>
        <AutoRootCtx />
        <Consumer />
      </>
    )

    await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('a'))
    await act(async () => { fireEvent.click(screen.getByTestId('value')) })
    await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('b'))
  })
})

describe('createStore instances', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should share instances for identical params', async () => {
    let renderCount = 0
    let mounted = 0
    const { useStore } = createStore('share-instance-test', () => {
      const [count] = React.useState(() => {
        renderCount++
        return renderCount
      })
      React.useEffect(() => {
        mounted++
        return () => { mounted-- }
      }, [])
      return { count }
    })

    function Consumer({ id }: { id: string }) {
      const { count } = useStore()
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
        // Both should have the same count, proving they share the same instance
        expect(count1).toBe(count2)
        expect(count1).not.toBe('')
        // one instance mounted (StrictMode in React 18 runs the useState initializer of a discarded render too)
        expect(mounted).toBe(1)
      }, { timeout: 5000 })
    })
  }, 5000)

  it('should create separate instances for different params', async () => {
    const { useStore } = createStore('separate-instance-test', ({ id }: { id: number }) => {
      const [value] = React.useState(id * 10)
      return { value }
    })

    function Consumer({ id }: { id: number }) {
      const { value } = useStore({ id })
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
    const { useStore } = createStore('cleanup-test', () => {
      const [count] = React.useState(99)
      return { count }
    }, { timeToClean: 100 })

    function Consumer({ show }: { show: boolean }) {
      const { count } = useStore()
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

      rerender(
        <>
          <AutoRootCtx />
          <Consumer show={false} />
        </>
      )

      // past timeToClean: no error while the instance goes
      await new Promise(resolve => setTimeout(resolve, 150))
      expect(screen.queryByTestId('count')).toBeNull()
    })
  }, 5000)

  it('should handle rapid mount/unmount cycles', async () => {
    const { useStore } = createStore('rapid-mount-test', () => {
      const [count] = React.useState(88)
      return { count }
    }, { timeToClean: 50 })

    function Consumer({ show }: { show: boolean }) {
      const { count } = useStore()
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

      rerender(
        <>
          <AutoRootCtx />
          <Consumer show={false} />
        </>
      )

      // less than timeToClean
      await new Promise(resolve => setTimeout(resolve, 25))

      rerender(
        <>
          <AutoRootCtx />
          <Consumer show={true} />
        </>
      )

      await waitFor(() => {
        // the same value: the instance was kept
        expect(screen.getByTestId('count').textContent).toBe('88')
      }, { timeout: 5000 })
    })
  }, 5000)

  it('should handle updates after auto-mounting', async () => {
    const { useStore } = createStore('auto-update-test', () => {
      const [count, setCount] = React.useState(0)
      return { count, increment: () => setCount(c => c + 1) }
    })

    function Consumer() {
      const { count, increment } = useStore()
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

      fireEvent.click(getByTestId('increment'))

      await waitFor(() => {
        expect(getByTestId('count').textContent).toBe('1')
      }, { timeout: 5000 })

      fireEvent.click(getByTestId('increment'))

      await waitFor(() => {
        expect(getByTestId('count').textContent).toBe('2')
      }, { timeout: 5000 })
    })
  }, 5000)
})

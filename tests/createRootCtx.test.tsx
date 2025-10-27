import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'
import { createRootCtx } from '../src/state-utils/createRootCtx'
import { useDataSubscribe } from '../src/state-utils/ctx'

describe('createRootCtx', () => {
  it('should create Root component and hooks', () => {
    const useCounter = () => {
      const [count, setCount] = React.useState(0)
      return { count, setCount }
    }

    const { Root, useCtxState } = createRootCtx('test-counter', useCounter)

    expect(Root).toBeDefined()
    expect(useCtxState).toBeDefined()
  })

  it('should provide context data through Root', () => {
    const useCounter = () => {
      const [count, setCount] = React.useState(42)
      return { count, setCount }
    }

    const { Root, useCtxState } = createRootCtx('provide-test', useCounter)

    function Consumer() {
      const ctx = useCtxState({})
      const count = useDataSubscribe(ctx, 'count')
      return <div data-testid="count">{count}</div>
    }

    render(
      <>
        <Root />
        <Consumer />
      </>
    )

    expect(screen.getByTestId('count').textContent).toBe('42')
  })

  it('should derive unique context names from props', () => {
    const useStore = ({ id }: { id: string }) => {
      const [value] = React.useState(id)
      return { value }
    }

    const { Root, useCtxState } = createRootCtx('unique-ctx', useStore)

    function Consumer({ id }: { id: string }) {
      const ctx = useCtxState({ id })
      const value = useDataSubscribe(ctx, 'value')
      return <div data-testid={`value-${id}`}>{value}</div>
    }

    render(
      <>
        <Root id="a" />
        <Root id="b" />
        <Consumer id="a" />
        <Consumer id="b" />
      </>
    )

    expect(screen.getByTestId('value-a').textContent).toBe('a')
    expect(screen.getByTestId('value-b').textContent).toBe('b')
  })

  it('should treat props with different key order as the same context', () => {
    const useStore = ({ a, b }: { a: number; b: number }) => {
      const [value] = React.useState(() => `${a}:${b}`)
      return { value }
    }

    const { Root, useCtxState } = createRootCtx('order-ctx', useStore)

    function ConsumerUnordered() {
      const ctx = useCtxState({ b: 2, a: 1 })
      const value = useDataSubscribe(ctx, 'value')
      return <div data-testid="value-unordered">{value}</div>
    }

    function ConsumerOrdered() {
      const ctx = useCtxState({ a: 1, b: 2 })
      const value = useDataSubscribe(ctx, 'value')
      return <div data-testid="value-ordered">{value}</div>
    }

    render(
      <>
        <Root a={1} b={2} />
        <ConsumerUnordered />
        <ConsumerOrdered />
      </>
    )

    expect(screen.getByTestId('value-unordered').textContent).toBe('1:2')
    expect(screen.getByTestId('value-ordered').textContent).toBe('1:2')
  })

  it('should handle updates from Root', async () => {
    const useCounter = () => {
      const [count, setCount] = React.useState(0)
      return { count, increment: () => setCount(c => c + 1) }
    }

    const { Root, useCtxState } = createRootCtx('update-test', useCounter)

    function Consumer() {
      const ctx = useCtxState({})
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
        <Root />
        <Consumer />
      </>
    )

    expect(getByTestId('count').textContent).toBe('0')

    // Click the increment button
    await act(async () => {
      getByTestId('increment').click()
      // Note: This might need async handling depending on how updates propagate
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    expect(getByTestId('count').textContent).toBe('1')
  })
})

describe('useCtxStateStrict', () => {
  it('should throw if Root not mounted', () => {
    const useCounter = () => {
      const [count] = React.useState(0)
      return { count }
    }

    const { useCtxStateStrict } = createRootCtx('strict-test', useCounter)

    function Consumer() {
      try {
        useCtxStateStrict({})
        return <div>Should not render</div>
      } catch (error: any) {
        return <div data-testid="error">{error.message}</div>
      }
    }

    // This should throw an error
    expect(() => {
      render(<Consumer />)
    }).toThrow()
  })

  it('should work when Root is mounted', () => {
    const useCounter = () => {
      const [count] = React.useState(100)
      return { count }
    }

    const { Root, useCtxStateStrict } = createRootCtx('strict-mounted', useCounter)

    function Consumer() {
      const ctx = useCtxStateStrict({})
      const count = useDataSubscribe(ctx, 'count')
      return <div data-testid="count">{count}</div>
    }

    render(
      <>
        <Root />
        <Consumer />
      </>
    )

    expect(screen.getByTestId('count').textContent).toBe('100')
  })
})

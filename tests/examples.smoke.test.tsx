import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import React from 'react'
import { AutoRootCtx } from '../src/index'
import CounterApp from '../src/examples/counter/app'
import TodoApp from '../src/examples/todo/app'
import FormApp from '../src/examples/form/app'
import TimerApp from '../src/examples/timer/app'
import CartApp from '../src/examples/cart/app'
import AsyncApp from '../src/examples/async/app'
import ComposeApp from '../src/examples/compose/app'
import ScopeApp from '../src/examples/scope/app'

const apps = { CounterApp, TodoApp, FormApp, TimerApp, CartApp, AsyncApp, ComposeApp, ScopeApp }

describe('demo examples', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  for (const [name, App] of Object.entries(apps)) {
    it(`${name} renders without errors`, async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      render(
        <>
          <AutoRootCtx />
          <App />
        </>
      )
      await act(async () => { await new Promise(r => setTimeout(r, 50)) })
      expect(errorSpy).not.toHaveBeenCalled()
    })
  }

  it('scope example keeps global and scoped counters independent', async () => {
    render(<><AutoRootCtx /><ScopeApp /></>)
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })
    const buttons = screen.getAllByRole('button', { name: /^A: / })
    expect(buttons).toHaveLength(3)
    await act(async () => { buttons[0].click() })
    expect(buttons[0].textContent).toBe('A: 1')
    expect(screen.getAllByRole('button', { name: /^B: / })[0].textContent).toBe('B: 1') // same global store
    expect(buttons[1].textContent).toBe('A: 0') // scope 1 untouched
    expect(buttons[2].textContent).toBe('A: 0') // scope 2 untouched
  })

  it('compose example recomputes invoices when settings change', async () => {
    render(<><AutoRootCtx /><ComposeApp /></>)
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })
    expect(screen.getAllByText('Total: $1760.00')).toHaveLength(2) // 1600 * 1.1
    const slider = screen.getByRole('slider') as HTMLInputElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(slider, '20')
      slider.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(screen.getAllByText('Total: $1920.00')).toHaveLength(2) // 1600 * 1.2
  })
})

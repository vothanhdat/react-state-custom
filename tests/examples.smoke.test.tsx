import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import React from 'react'
import { AutoRootCtx } from '../src/index'
import CounterApp from '../src/examples/counter/app'
import TodoApp from '../src/examples/todo/app'
import SelectorsApp from '../src/examples/selectors/app'
import TimerApp from '../src/examples/timer/app'
import OutsideApp from '../src/examples/outside/app'
import AsyncApp from '../src/examples/async/app'
import ComposeApp from '../src/examples/compose/app'
import MultipleApp from '../src/examples/multiple/app'
import RoomsApp from '../src/examples/rooms/app'
import NestedApp from '../src/examples/nested/app'

const apps = { CounterApp, TodoApp, SelectorsApp, TimerApp, OutsideApp, AsyncApp, ComposeApp, MultipleApp, RoomsApp, NestedApp }

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

  it('multiple example reads a list of instances, each started and stopped with the list', async () => {
    render(<><AutoRootCtx /><MultipleApp /></>)
    const settle = () => act(async () => { await new Promise(r => setTimeout(r, 20)) })
    await settle()
    expect(screen.getByText('A = 0 · B = 0')).toBeTruthy()
    await act(async () => { screen.getByRole('button', { name: 'B: 0' }).click() })
    await act(async () => { screen.getByRole('button', { name: 'B: 1' }).click() })
    expect(screen.getByText('A = 0 · B = 2')).toBeTruthy()
    expect(screen.getByText('Total: 2')).toBeTruthy()

    await act(async () => { screen.getByRole('button', { name: 'Add' }).click() })
    await settle()
    expect(screen.getByText('A = 0 · B = 2 · C = 0')).toBeTruthy()
    await act(async () => { screen.getByRole('button', { name: 'Remove' }).click() })
    await act(async () => { screen.getByRole('button', { name: 'Remove' }).click() })
    await settle()
    expect(screen.getByText('Total: 0')).toBeTruthy()
    // B stopped when it left the list: it comes back from 0
    await act(async () => { screen.getByRole('button', { name: 'Add' }).click() })
    await settle()
    expect(screen.getByText('A = 0 · B = 0')).toBeTruthy()
  })

  it('selectors example re-renders only the affected consumers', async () => {
    vi.useFakeTimers()
    try {
      render(<><AutoRootCtx /><SelectorsApp /></>)
      await act(async () => { await vi.advanceTimersByTimeAsync(1100) }) // fake fetch resolves
      expect(screen.getByText('User ada')).toBeTruthy() // the profile loaded
      // The <h3> holds the title and the "renders: n" badge (StrictMode doubles n; only deltas matter).
      const renders = (title: string) =>
        Number(screen.getByText(title).textContent!.match(/renders: (\d+)/)![1])
      const likesBefore = renders('selector: likes')
      const tagsBefore = renders('selector: tags')
      await act(async () => { screen.getByRole('button', { name: 'Rename' }).click() })
      expect(renders('selector: likes')).toBe(likesBefore) // likes unchanged: no re-render
      expect(renders('selector: tags')).toBe(tagsBefore)   // same tags: shallowly equal, no change
      await act(async () => { screen.getByRole('button', { name: 'Like' }).click() })
      expect(renders('selector: likes')).toBeGreaterThan(likesBefore)
      expect(screen.getByText('1 likes')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('outside example drives the store from module code through storeRef()', async () => {
    vi.useFakeTimers()
    try {
      render(<><AutoRootCtx /><OutsideApp /></>)
      await act(async () => { screen.getByRole('button', { name: 'Connect feed' }).click() })
      await act(async () => { await vi.advanceTimersByTimeAsync(1100) }) // two feed ticks
      expect(screen.getByText('2 updates')).toBeTruthy()
      expect(screen.getByText('subscribe() log').parentElement!.textContent).toMatch(/BTC/)
      await act(async () => { screen.getByRole('button', { name: 'Disconnect feed' }).click() })
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      expect(screen.getByText('2 updates')).toBeTruthy() // feed stopped
    } finally {
      vi.useRealTimers()
    }
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
    expect(screen.getByText('Grand total: $3840.00')).toBeTruthy()  // summary store follows both invoices
    await act(async () => { screen.getAllByRole('button', { name: 'Add line' })[0].click() })
    expect(screen.getByText('Grand total: $3960.00')).toBeTruthy()  // + 100 * 1.2
    expect(screen.getByText(/5 lines/)).toBeTruthy()
  })

  it('rooms example: one connection per room, closed with the room, messages kept for a reopen', async () => {
    vi.useFakeTimers()
    try {
      render(<><AutoRootCtx /><RoomsApp /></>)
      await act(async () => { await vi.advanceTimersByTimeAsync(400) })
      const log = () => screen.getByText('Connections').parentElement!.textContent!
      expect(log().match(/#general open/g)).toHaveLength(1) // three widgets, one connection
      expect(screen.getByText('🟢 connected')).toBeTruthy()

      await act(async () => { await vi.advanceTimersByTimeAsync(2000) }) // one message from the server
      expect(screen.getByRole('button', { name: /#general\s*\(1\)/ })).toBeTruthy() // the tab's unread badge

      expect(log()).not.toMatch(/closed/)
      await act(async () => { screen.getByRole('button', { name: 'Close' }).click() })
      expect(log()).toMatch(/#general closed/)
      await act(async () => { await vi.advanceTimersByTimeAsync(5000) }) // closed: nothing arrives
      await act(async () => { screen.getByRole('button', { name: '#general' }).click() })
      expect(screen.getAllByRole('listitem')).toHaveLength(1) // kept by the history store, shown at once
    } finally {
      vi.useRealTimers()
    }
  })

  it('nested example: a selector or the flat store renders only the cells whose value changed', async () => {
    render(<><AutoRootCtx /><NestedApp /></>)
    const settle = () => act(async () => { await new Promise(r => setTimeout(r, 100)) })
    const press = async (name: string) => { await act(async () => { screen.getByRole('button', { name }).click() }); await settle() }
    const rendered = () => ['nested', 'selector', 'flat'].map(mode => screen.getByTestId(`rendered-${mode}`).textContent)
    await settle()

    await press('Same values, new object')
    expect(rendered()).toEqual(['4 of 4 rendered', '0 of 4 rendered', '0 of 4 rendered'])
    await press('+1 score') // 9: the tier stays silver
    expect(rendered()).toEqual(['4 of 4 rendered', '1 of 4 rendered', '1 of 4 rendered'])
    await press('+1 score') // 10: the tier turns gold
    expect(rendered()).toEqual(['4 of 4 rendered', '2 of 4 rendered', '2 of 4 rendered'])
    expect(screen.getAllByText('gold')).toHaveLength(3)
  })
})

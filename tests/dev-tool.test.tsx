import React, { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { AutoRootCtx, createStore } from '../src'
import { getContext } from '../src/state-utils/ctx'
import { DevToolContainer, DevToolState, StateView } from '../src/dev-tool'

const { useStore: useCounter } = createStore('dt-counter', ({ initial = 0 }: { initial?: number }) => {
  const [count, setCount] = useState(initial)
  return { count, increment: () => setCount(c => c + 1) }
})
const { useStore: useOther } = createStore('dt-other', () => ({ label: 'other' }))

const Counter = ({ initial }: { initial?: number }) => {
  const { count, increment } = useCounter({ initial })
  return <button onClick={increment}>count:{count}</button>
}
const Other = () => <span>{useOther().label}</span>

const openPanel = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Toggle Dev Tool' }))
  return screen.getByRole('region', { name: 'react-state-custom stores' })
}

afterEach(() => sessionStorage.clear())

describe('DevToolContainer', () => {
  it('lists mounted stores grouped by name, shows a selected one live, and never creates contexts', async () => {
    render(<><AutoRootCtx /><Counter initial={5} /><Other /><DevToolContainer /></>)
    await screen.findByText('count:5')
    const before = getContext.cache.size

    const panel = await openPanel()
    expect(within(panel).getByText('DT-COUNTER'.toLowerCase(), { exact: false })).toBeTruthy()
    expect(within(panel).getByText('dt-other')).toBeTruthy()
    expect(within(panel).queryByText(/auto-ctx/)).toBeNull()
    expect(getContext.cache.size).toBe(before)

    // the instance is labelled by its decoded params, with its key count
    const instance = within(panel).getByRole('button', { name: /initial=5/ })
    expect(instance.textContent).toContain('2 keys')
    await userEvent.click(instance)

    const view = panel.querySelector('[data-store="dt-counter?initial=5"]')!
    expect(view.textContent).toContain('"count": 5')
    expect(view.textContent).toContain('"increment": "ƒ increment()"')

    await userEvent.click(screen.getByText('count:5'))
    await waitFor(() => expect(view.textContent).toContain('"count": 6'))
    expect(getContext.cache.size).toBe(before)
  })

  it('filters the list and highlights the match', async () => {
    render(<><AutoRootCtx /><Counter /><Other /><DevToolContainer /></>)
    await screen.findByText('count:0')
    const panel = await openPanel()

    await userEvent.type(within(panel).getByRole('searchbox', { name: 'Filter stores' }), 'other')
    expect(within(panel).queryByText(/initial|no params/)).toBeTruthy()
    expect(within(panel).queryByText('dt-counter')).toBeNull()
    expect(panel.querySelector('mark')?.textContent).toBe('other')
  })

  it('marks a selected store as unmounted when it goes away, and follows a remounted instance', async () => {
    const App = () => {
      const [show, setShow] = useState(true)
      return <>
        <AutoRootCtx />
        <button onClick={() => setShow(s => !s)}>toggle</button>
        {show && <Counter initial={1} />}
        <DevToolContainer />
      </>
    }
    render(<App />)
    await screen.findByText('count:1')
    const panel = await openPanel()
    await userEvent.click(within(panel).getByRole('button', { name: /initial=1/ }))
    const view = () => panel.querySelector('[data-store="dt-counter?initial=1"]')!

    await userEvent.click(screen.getByText('count:1'))
    await waitFor(() => expect(view().textContent).toContain('"count": 2'))

    await userEvent.click(screen.getByText('toggle'))
    await waitFor(() => expect(view().textContent).toContain('unmounted'))
    expect(view().textContent).toContain('"count": 2')          // last known data stays visible
    expect(within(panel.querySelector('.state-list')!).queryByRole('button', { name: /initial=1/ })).toBeNull()

    await userEvent.click(screen.getByText('toggle'))            // fresh instance, back to initial
    await screen.findByText('count:1')
    await waitFor(() => expect(view().textContent).not.toContain('unmounted'))
    await waitFor(() => expect(view().textContent).toContain('"count": 1'))

    await userEvent.click(within(view()).getByRole('button', { name: /Close dt-counter/ }))
    expect(panel.querySelector('[data-store="dt-counter?initial=1"]')).toBeNull()
  })

  it('hides the trigger while open, closes from the panel, and remembers the open state per tab', async () => {
    const { unmount } = render(<><AutoRootCtx /><DevToolContainer /></>)
    const trigger = screen.getByRole('button', { name: 'Toggle Dev Tool' })
    expect(trigger.getAttribute('data-active')).toBe('false')
    await userEvent.click(trigger)
    expect(trigger.getAttribute('data-active')).toBe('true')
    expect(screen.getByText('No store mounted')).toBeTruthy()

    unmount()
    render(<><AutoRootCtx /><DevToolContainer /></>)
    expect(screen.getByRole('region', { name: 'react-state-custom stores' })).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Close dev tool' }))
    expect(screen.queryByRole('region')).toBeNull()
    expect(screen.getByRole('button', { name: 'Toggle Dev Tool' }).getAttribute('data-active')).toBe('false')
  })

  it('forwards button props and renders children as the label, opens with defaultOpen', () => {
    render(<DevToolContainer defaultOpen defaultHeight={300} className="my-btn" style={{ left: 4 }}>Stores</DevToolContainer>)
    const trigger = screen.getByRole('button', { name: 'Stores' })
    expect(trigger.className).toBe('my-btn')
    expect(trigger.style.left).toBe('4px')
    expect(screen.getByRole('region', { name: 'react-state-custom stores' }).style.height).toBe('300px')
  })

  it('resizes the panel by dragging its top edge', () => {
    render(<DevToolContainer defaultOpen defaultHeight={300} />)
    const panel = screen.getByRole('region', { name: 'react-state-custom stores' })
    const handle = panel.querySelector('.react-state-dev-bar')!
    fireEvent.pointerDown(handle, { button: 0, clientY: 500, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 400, pointerId: 1 })        // dragged up by 100px
    expect(panel.style.height).toBe('400px')
    fireEvent.pointerMove(handle, { clientY: 900, pointerId: 1 })        // below the minimum
    expect(panel.style.height).toBe('120px')
    fireEvent.pointerUp(handle, { pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 })        // released: no effect
    expect(panel.style.height).toBe('120px')
  })
})

describe('DevToolState and StateView', () => {
  it('embed without the trigger, with a default renderer', async () => {
    render(<><AutoRootCtx /><Counter initial={9} /><DevToolState /></>)
    await screen.findByText('count:9')
    await userEvent.click(await screen.findByRole('button', { name: /initial=9/ }))
    expect(document.querySelector('[data-store="dt-counter?initial=9"]')?.textContent).toContain('"count": 9')
  })

  it('StateView renders one store by name with a custom component and does not create it', async () => {
    const Custom = ({ name, value }: { name: string, value: any }) => <i>{name}:{String(value.count)}</i>
    render(<><AutoRootCtx /><Counter initial={4} /><StateView dataKey="dt-counter?initial=4" Component={Custom} /><StateView dataKey="dt-missing" /></>)
    await screen.findByText('count:4')
    expect((await screen.findByText('dt-counter?initial=4:4')).tagName).toBe('I')
    expect(screen.getByText('unmounted')).toBeTruthy()
    expect(getContext.fromCache('dt-missing')).toBeUndefined()
    await act(async () => { await userEvent.click(screen.getByText('count:4')) })
    await screen.findByText('dt-counter?initial=4:5')
  })
})

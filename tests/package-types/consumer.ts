// What an app writes against the built package. Each @ts-expect-error fails the check when the
// types resolve to `any`, which is what a broken declaration import silently gives.
import { createStore, useMultipleStore, shallowEqual, type StoreState } from 'react-state-custom'
import { frame, type Scheduler } from 'react-state-custom/schedulers'
import { mockStore, waitForStore } from 'react-state-custom/testing'
import { DevToolContainer } from 'react-state-custom/dev-tool'
import { ObjectDataView } from 'react-state-custom/dev-tool/obj-view'

const counter = createStore('counter', ({ start }: { start: number }) => ({ count: start, inc: () => { } }))

// @ts-expect-error params are required
counter.useStore()
// @ts-expect-error select returns a number
export const selected: string = counter.useStore({ start: 1 }, { select: s => s.count ?? 0, schedule: frame() })
// @ts-expect-error count is a number
export const many: string = useMultipleStore([counter.storeRef({ start: 1 })])[0].count
// @ts-expect-error a scheduler, not a string
export const scheduler: Scheduler = 'frame'
// @ts-expect-error count is a number
export const wrong: StoreState<{ count: number }, {}> = { count: 'one' }
// @ts-expect-error a value the store never holds
mockStore(counter.useStore, { count: 'one' })
export const waited = waitForStore(counter.useStore, { start: 1 }, ['count']).then(state => {
  // @ts-expect-error count is present, and a number
  const text: string = state.count
  return text
})
// @ts-expect-error defaultOpen is a boolean
DevToolContainer({ defaultOpen: 'yes' })
// @ts-expect-error a component, not a string
export const view: string = ObjectDataView
export const same: boolean = shallowEqual([1], [1])

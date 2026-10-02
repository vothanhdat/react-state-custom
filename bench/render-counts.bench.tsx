import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { bench, describe } from 'vitest'
import { adapters } from './adapters'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

/**
 * Not a timing benchmark: prints how many Consumer renders one update costs per library.
 * 1000 consumers over 10 keys, one key updated -> 100 consumers hold the changed value.
 */
describe('consumer renders per update (1000 consumers, 10 keys, 1 key changed)', () => {
  let printed = false
  bench('report', () => {
    if (printed) return
    printed = true
    const rows = adapters.map(adapter => {
      const world = adapter.create(10)
      const container = document.createElement('div')
      const root = createRoot(container)
      const { Providers, Consumer } = world
      act(() => { root.render(<Providers>{Array.from({ length: 1000 }, (_, i) => <Consumer key={i} k={i % 10} />)}</Providers>) })
      const mountRenders = world.counter.renders
      world.counter.renders = 0
      act(() => { world.update(3, 1) })
      const updateRenders = world.counter.renders
      act(() => { root.unmount() })
      return `| ${adapter.name} | ${mountRenders} | ${updateRenders} |`
    })
    console.log(['| library | consumer renders to mount | consumer renders per update |', '|---|---|---|', ...rows].join('\n'))
  }, { iterations: 1, warmupIterations: 0, time: 0 })
})

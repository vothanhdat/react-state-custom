import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { cases } from './cases'

const container = document.getElementById('bench')!
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const frame = () => new Promise(r => requestAnimationFrame(r))

/**
 * Mount a case, run `warmup` steps, then time `iterations` more. A sample is one step inside
 * `flushSync` (every render and commit it causes) plus a forced layout; the page gets a frame to
 * paint every 10 steps, untimed. The DOM is read after the timed loop.
 */
async function runCase(id: string, warmup: number, iterations: number) {
  const c = cases.find(c => c.id === id)
  if (!c) throw Error(`unknown case: ${id}`)
  const world = c.create()
  const root = createRoot(container)
  const { Providers, Consumer } = world
  flushSync(() => root.render(<Providers>{Array.from({ length: c.consumers }, (_, i) => <Consumer key={i} k={i % c.slots} />)}</Providers>))
  await sleep(100) // stores mount from effects and publish their first value
  await frame()

  let tick = 0
  const step = () => c.step(world, ++tick)
  for (let i = 0; i < warmup; i++) { flushSync(step); void container.offsetHeight }
  const before: Record<string, number> = { ...world.counters }
  const samples: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    flushSync(step)
    void container.offsetHeight
    samples.push(performance.now() - start)
    if (i % 10 === 9) await frame()
  }
  const perUpdate = Object.fromEntries(Object.entries(world.counters).map(([k, v]) => [k, (v - before[k]) / iterations]))

  const values = Array.from(container.querySelectorAll('i'), el => Number(el.textContent))
  let mismatch: string | undefined
  if (values.length !== c.consumers) mismatch = `${values.length} consumers in the DOM, expected ${c.consumers}`
  else if (c.expected) {
    const want = c.expected(tick)
    const i = values.findIndex((v, i) => v !== want[i])
    if (i >= 0) mismatch = `consumer ${i} shows ${values[i]}, expected ${want[i]}`
  }
  flushSync(() => root.unmount())
  await sleep(150) // instances are evicted before the next case
  return { samples, perUpdate, ticks: tick, mismatch, values: c.expected ? undefined : values }
}

const manifest = () => ({
  userAgent: navigator.userAgent,
  production: import.meta.env.PROD,
  crossOriginIsolated,
  viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
  cases: cases.map(({ id, suite, scenario, library, consumers }) => ({ id, suite, scenario, library, consumers })),
})

;(window as any).benchmark = { manifest, runCase }

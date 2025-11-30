import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import React from 'react'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'
import { DependencyTracker } from '../src/state-utils/utils'

describe('Circular Dependency Detection', () => {
  beforeEach(() => {
    // Reset graph for tests
    DependencyTracker.graph.clear()
    DependencyTracker.stack = []
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should detect circular dependency between two stores', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    let storeB: any;

    // Store A depends on Store B
    const useStoreA = () => {
      const { countB } = storeB.useStore({})
      return { countA: (countB || 0) + 1 }
    }
    const storeA = createStore('store-A', useStoreA)

    // Store B depends on Store A
    const useStoreB = () => {
      const { countA } = storeA.useStore({})
      return { countB: (countA || 0) + 1 }
    }
    storeB = createStore('store-B', useStoreB)

    function App() {
      storeA.useStore({})
      return null
    }

    render(
      <>
        <AutoRootCtx />
        <App />
      </>
    )

    // Wait for both to mount and cycle to be detected
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circular dependency detected')
      )
    }, { timeout: 2000 })
    
    // Verify the message content
    const warning = consoleSpy.mock.calls.find(call => 
      call[0].includes('Circular dependency detected')
    )?.[0]
    
    expect(warning).toMatch(/Circular dependency detected: store-[AB] -> \.\.\. -> store-[AB]/)
  })

  it('should not warn for non-circular dependencies', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    let storeD: any;

    // Store C depends on Store D
    const useStoreC = () => {
      const { val } = storeD.useStore({})
      return { valC: val }
    }
    const storeC = createStore('store-C', useStoreC)

    // Store D is independent
    const useStoreD = () => {
      return { val: 1 }
    }
    storeD = createStore('store-D', useStoreD)

    function App() {
      storeC.useStore({})
      return null
    }

    render(
      <>
        <AutoRootCtx />
        <App />
      </>
    )

    // Wait a bit to ensure rendering happened
    await act(async () => {
      await new Promise(r => setTimeout(r, 100))
    })

    const warnings = consoleSpy.mock.calls.filter(call => 
      call[0].includes('Circular dependency detected')
    )
    expect(warnings.length).toBe(0)
  })
})

import React, { useEffect, useReducer } from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

// Proves the React Compiler is applied to this directory: a compiled component reads its memo
// cache through `_c(n)` (react/compiler-runtime's useMemoCache), which shows in its source.
// The compiler's memo cache: `const $ = _c(n)` (vite rewrites the import name, hence the loose match).
export const COMPILED = /const \$ = .*\(\d+\);/

const box = { n: 0 }
let force: () => void = () => { }

const Canary = () => {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  useEffect(() => { force = bump })
  return <span data-testid="n">{box.n}</span>
}

describe('react compiler canary', () => {
  it('compiles components in this directory', () => {
    expect(Canary.toString()).toMatch(COMPILED)
  })

  it('memoises JSX that reads a module-level object (what makes stable mutable objects unsafe)', () => {
    render(<Canary />)
    expect(screen.getByTestId('n').textContent).toBe('0')
    box.n = 1
    act(() => force())
    expect(screen.getByTestId('n').textContent).toBe('0')
  })
})

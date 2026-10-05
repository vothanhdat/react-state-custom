import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import React from 'react'
import { createStore, AutoRootCtx } from '../src'
import { withRealTimers } from './utils'

describe('Integration scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('coordinates readers with action publishers', async () => {
    const { useStore: useTodos } = createStore('integration-todo', () => {
      const [items, setItems] = React.useState(['initial'])
      const addItem = React.useCallback(() => {
        setItems(previous => [...previous, `item-${previous.length}`])
      }, [])
      const removeItem = React.useCallback(() => {
        setItems(previous => (previous.length > 1 ? previous.slice(0, -1) : previous))
      }, [])
      const count = items.length
      return { items, addItem, removeItem, count }
    }, { timeToClean: 10 })

    function TodoList() {
      const { items = [], count } = useTodos()
      return (
        <div>
          <div data-testid="items">{items.join(',')}</div>
          <div data-testid="count">{count ?? ''}</div>
        </div>
      )
    }

    function TodoControls() {
      const { addItem, removeItem } = useTodos()
      return (
        <div>
          <button data-testid="add" onClick={() => addItem?.()}>
            add
          </button>
          <button data-testid="remove" onClick={() => removeItem?.()}>
            remove
          </button>
        </div>
      )
    }

    render(
      <>
        <AutoRootCtx />
        <TodoList />
        <TodoControls />
      </>
    )

    await withRealTimers(async () => {
      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('1')
      })

      fireEvent.click(screen.getByTestId('add'))
      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('2')
        expect(screen.getByTestId('items').textContent).toBe('initial,item-1')
      })

      fireEvent.click(screen.getByTestId('add'))
      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('3')
        expect(screen.getByTestId('items').textContent).toBe('initial,item-1,item-2')
      })

      fireEvent.click(screen.getByTestId('remove'))
      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('2')
        expect(screen.getByTestId('items').textContent).toBe('initial,item-1')
      })
    })
  })

  it('keeps proxy readers and selections in sync', async () => {
    const { useStore: useProfile } = createStore('integration-profile', () => {
      const [firstName, setFirstName] = React.useState('Ada')
      const [lastName, setLastName] = React.useState('Lovelace')
      const fullName = `${firstName} ${lastName}`.trim()
      const updateName = React.useCallback((first: string, last: string) => {
        setFirstName(first)
        setLastName(last)
      }, [])

      return { firstName, lastName, fullName, updateName }
    })

    function ProfileView() {
      const { firstName, lastName } = useProfile()
      const fullNameUpper = useProfile(undefined, { select: s => s.fullName?.toUpperCase() ?? '' })

      return (
        <div>
          <div data-testid="name">{`${firstName ?? ''} ${lastName ?? ''}`.trim()}</div>
          <div data-testid="fullNameUpper">{fullNameUpper}</div>
        </div>
      )
    }

    function RenameButton() {
      const { updateName } = useProfile()
      return (
        <button
          data-testid="rename"
          onClick={() => updateName?.('Grace', 'Hopper')}
        >
          rename
        </button>
      )
    }

    render(
      <>
        <AutoRootCtx />
        <ProfileView />
        <RenameButton />
      </>
    )

    await withRealTimers(async () => {
      await waitFor(() => {
        expect(screen.getByTestId('name').textContent).toBe('Ada Lovelace')
        expect(screen.getByTestId('fullNameUpper').textContent).toBe('ADA LOVELACE')
      })

      fireEvent.click(screen.getByTestId('rename'))

      await waitFor(() => {
        expect(screen.getByTestId('name').textContent).toBe('Grace Hopper')
        expect(screen.getByTestId('fullNameUpper').textContent).toBe('GRACE HOPPER')
      })
    })
  })

  it('allows one store to derive values from another store', async () => {
    const { useStore: useSettings } = createStore('integration-settings', () => {
      const [theme, setTheme] = React.useState<'light' | 'dark'>('light')
      const toggleTheme = React.useCallback(() => {
        setTheme(previous => (previous === 'light' ? 'dark' : 'light'))
      }, [])

      return { theme, toggleTheme }
    }, { timeToClean: 10 })

    const { useStore: useSummary } = createStore('integration-summary', () => {
      const { theme = 'light' } = useSettings()
      return {
        theme,
        isDark: theme === 'dark'
      }
    }, { timeToClean: 10 })

    function ThemeSummary() {
      const { theme, isDark } = useSummary()
      return (
        <div>
          <div data-testid="theme">{theme}</div>
          <div data-testid="isDark">{`${isDark}`}</div>
        </div>
      )
    }

    function ThemeToggle() {
      const { theme, toggleTheme } = useSettings()
      return (
        <button data-testid="toggle" onClick={() => toggleTheme?.()}>
          toggle-{theme}
        </button>
      )
    }

    render(
      <>
        <AutoRootCtx />
        <ThemeSummary />
        <ThemeToggle />
      </>
    )

    await withRealTimers(async () => {
      await waitFor(() => {
        expect(screen.getByTestId('theme').textContent).toBe('light')
        expect(screen.getByTestId('isDark').textContent).toBe('false')
      })

      fireEvent.click(screen.getByTestId('toggle'))

      await waitFor(() => {
        expect(screen.getByTestId('theme').textContent).toBe('dark')
        expect(screen.getByTestId('isDark').textContent).toBe('true')
      })

      fireEvent.click(screen.getByTestId('toggle'))

      await waitFor(() => {
        expect(screen.getByTestId('theme').textContent).toBe('light')
        expect(screen.getByTestId('isDark').textContent).toBe('false')
      })
    })
  })
})

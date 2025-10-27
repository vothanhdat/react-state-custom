import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import React from 'react'
import { createRootCtx } from '../src/state-utils/createRootCtx'
import { createAutoCtx, AutoRootCtx } from '../src/state-utils/createAutoCtx'
import { useQuickSubscribe } from '../src/state-utils/useQuickSubscribe'
import {
  useDataSubscribe,
  useDataSubscribeMultiple,
  useDataSubscribeWithTransform
} from '../src/state-utils/ctx'
import { withRealTimers } from './utils'

describe('Integration scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('coordinates quick subscribers with action publishers', async () => {
    const useTodoState = () => {
      const [items, setItems] = React.useState(['initial'])
      const addItem = React.useCallback(() => {
        setItems(previous => [...previous, `item-${previous.length}`])
      }, [])
      const removeItem = React.useCallback(() => {
        setItems(previous => (previous.length > 1 ? previous.slice(0, -1) : previous))
      }, [])
      const count = items.length
      return { items, addItem, removeItem, count }
    }

    const rootCtx = createRootCtx('integration-todo', useTodoState)
    const autoCtx = createAutoCtx(rootCtx, 10)

    function TodoList() {
      const ctx = autoCtx.useCtxState({})
      const proxy = useQuickSubscribe(ctx)
      const count = useDataSubscribe(ctx, 'count')
      const items = (proxy.items as string[] | undefined) ?? []

      return (
        <div>
          <div data-testid="items">{items.join(',')}</div>
          <div data-testid="count">{count ?? ''}</div>
        </div>
      )
    }

    function TodoControls() {
      const ctx = autoCtx.useCtxState({})
      const addItem = useDataSubscribe(ctx, 'addItem')
      const removeItem = useDataSubscribe(ctx, 'removeItem')

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

  it('keeps multi-subscribers and transforms in sync', async () => {
    const useProfileState = () => {
      const [firstName, setFirstName] = React.useState('Ada')
      const [lastName, setLastName] = React.useState('Lovelace')
      const fullName = `${firstName} ${lastName}`.trim()
      const updateName = React.useCallback((first: string, last: string) => {
        setFirstName(first)
        setLastName(last)
      }, [])

      return { firstName, lastName, fullName, updateName }
    }

    const rootCtx = createRootCtx('integration-profile', useProfileState)
    const autoCtx = createAutoCtx(rootCtx)

    function ProfileView() {
      const ctx = autoCtx.useCtxState({})
      const names = useDataSubscribeMultiple(ctx, 'firstName', 'lastName') as {
        firstName?: string
        lastName?: string
      }
      const fullNameUpper = useDataSubscribeWithTransform(
        ctx,
        'fullName',
        value => (value ? value.toUpperCase() : '')
      )

      return (
        <div>
          <div data-testid="name">{`${names.firstName ?? ''} ${names.lastName ?? ''}`.trim()}</div>
          <div data-testid="fullNameUpper">{fullNameUpper}</div>
        </div>
      )
    }

    function RenameButton() {
      const ctx = autoCtx.useCtxState({})
      const updateName = useDataSubscribe(ctx, 'updateName')

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

  it('allows one context to derive values from another context', async () => {
    const useSettingsState = () => {
      const [theme, setTheme] = React.useState<'light' | 'dark'>('light')
      const toggleTheme = React.useCallback(() => {
        setTheme(previous => (previous === 'light' ? 'dark' : 'light'))
      }, [])

      return { theme, toggleTheme }
    }

    const settingsRoot = createRootCtx('integration-settings', useSettingsState)
    const settingsAuto = createAutoCtx(settingsRoot, 10)

    const useSummaryState = () => {
      const settingsCtx = settingsAuto.useCtxState({})
      const theme = useDataSubscribe(settingsCtx, 'theme') ?? 'light'
      return {
        theme,
        isDark: theme === 'dark'
      }
    }

    const summaryRoot = createRootCtx('integration-summary', useSummaryState)
    const summaryAuto = createAutoCtx(summaryRoot, 10)

    function ThemeSummary() {
      const ctx = summaryAuto.useCtxState({})
      const theme = useDataSubscribe(ctx, 'theme')
      const isDark = useDataSubscribe(ctx, 'isDark')

      return (
        <div>
          <div data-testid="theme">{theme}</div>
          <div data-testid="isDark">{`${isDark}`}</div>
        </div>
      )
    }

    function ThemeToggle() {
      const ctx = settingsAuto.useCtxState({})
      const theme = useDataSubscribe(ctx, 'theme')
      const toggleTheme = useDataSubscribe(ctx, 'toggleTheme')

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

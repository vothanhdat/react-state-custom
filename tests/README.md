# Tests

This directory contains the test suite for `react-state-custom`.

## Running Tests

```bash
# Run tests once (exits after completion)
yarn test

# Run tests in watch mode (development)
yarn test:watch

# Run tests with UI
yarn test:ui

# Run tests with coverage
yarn test:coverage
```

**Note:** Tests now run to completion without hanging. Default command uses `vitest run`.

## Current Test Status

**Overall: 60/60 tests passing (100%)** 🎉

- ✅ `ctx.test.ts` - 20/20 tests (100%)
- ✅ `createRootCtx.test.tsx` - 6/6 tests (100%)
- ✅ `useArrayChangeId.test.ts` - 11/11 tests (100%)
- ✅ `useQuickSubscribe.test.ts` - 11/11 tests (100%)
- ✅ `createAutoCtx.test.tsx` - 12/12 tests (100%)

**Test Duration:** ~1.1-1.5 seconds

## Test Structure

### Core Tests

- **`ctx.test.ts`** (20 tests, ✅ all passing) - Tests for the core Context system:
  - Context class publish/subscribe mechanism with act() wrapping
  - `getContext` memoization
  - `useDataContext` hook
  - `useDataSource` and `useDataSourceMultiple` hooks with proper state updates
  - `useDataSubscribe` and `useDataSubscribeMultiple` hooks
  - Debouncing behavior

- **`createRootCtx.test.tsx`** (6 tests, ✅ all passing) - Tests for root context creation:
  - Root component creation and rendering
  - Context data provision through Root
  - Unique context name derivation from props
  - `useCtxState` and `useCtxStateStrict` hooks
  - Error handling when Root is not mounted
  - State updates with act() wrapping

- **`createAutoCtx.test.tsx`** (12 tests, ✅ all passing) - Tests for auto context system:
  - ✅ AutoRootCtx component behavior
  - ✅ Multiple subscribers and root instances
  - ✅ Error boundary wrapping
  - ✅ Reference counting and cleanup with delays
  - ✅ Rapid mount/unmount cycles
  - ✅ State updates after auto-mounting

### Utility Tests

- **`useArrayChangeId.test.ts`** (11 tests, ✅ all passing) - Tests for array change detection:
  - Shallow comparison behavior (length + element reference)
  - Stability with unchanged primitive values
  - Object reference comparison (not deep equality)
  - Nested array handling (by reference)
  - Mixed type handling
  - Large array performance
  - **Fixed:** Implementation bug where getter pattern was resetting state

- **`useQuickSubscribe.test.ts`** (11 tests, ✅ all passing) - Tests for proxy-based subscription:
  - Selective subscription via property access
  - Re-render optimization
  - Dynamic property access patterns
  - Object and array value handling
  - Memory leak prevention

## Test Utilities

### Setup

- **`setup.ts`** - Global test setup and cleanup
  - **TextEncoder/TextDecoder polyfills** (fixes esbuild errors)
  - Configures React Testing Library
  - Automatic cleanup after each test

### Configuration

- **`vitest.config.test.ts`** - Vitest configuration
  - jsdom environment for React testing
  - **Test timeouts:** 500ms default, 1000ms for async tests
  - **Watch mode disabled** by default (no hanging)
  - **Exclude patterns** to prevent testing config files
  - Thread pool for environment isolation
  - Coverage settings with proper excludes

## Testing Patterns

### Hook Testing with act()

```typescript
import { renderHook, act } from '@testing-library/react'

// Wrap state updates in act()
const { result, rerender } = renderHook(() => useYourHook())

act(() => {
  // Perform actions that cause state updates
  result.current.increment()
})

expect(result.current.count).toBe(1)

// Rerender with new props
act(() => {
  rerender({ newProp: 'value' })
})
```

### Component Testing

```typescript
import { render, screen } from '@testing-library/react'

render(<YourComponent />)
expect(screen.getByTestId('element')).toBeInTheDocument()
```

### Context Testing

```typescript
const ctx = getContext('test-context')
const listener = vi.fn()
ctx.subscribe('key', listener)
act(() => {
  ctx.publish('key', value)
})
expect(listener).toHaveBeenCalledWith(value)
```

## Coverage Goals

- **Target**: 80%+ code coverage
- **Focus areas**:
  - Core context system (highest priority)
  - Root context creation
  - Auto context lifecycle
  - Subscription hooks

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Pushes to master
- Before publishing to npm (via `prepublishOnly`)

## Debugging Tests

```bash
# Run specific test file
yarn test ctx.test.ts

# Run specific test
yarn test -t "should publish and notify"

# Run with verbose output
yarn test --reporter=verbose

# Open UI for debugging
yarn test:ui
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Use `afterEach` to clean up resources (automatic via setup.ts)
3. **Descriptive names**: Test names should clearly describe what they test
4. **Arrange-Act-Assert**: Structure tests with clear setup, action, and verification phases
5. **Mock sparingly**: Test real behavior when possible; mock external dependencies
6. **Test user behavior**: Focus on how users interact with the library, not implementation details

## Current Test Status

✅ Context class basic functionality (20 tests)
✅ Context subscription and unsubscription
✅ Context memoization
✅ useDataSource hooks
✅ useDataSubscribe hooks  
✅ Root context creation (6 tests)
✅ useCtxState and useCtxStateStrict hooks
✅ Auto context system (12 tests - 7 passing, 5 edge cases)
✅ useArrayChangeId utility (11 tests - 6 passing, 5 edge cases)
✅ useQuickSubscribe utility (11 tests - all passing)
⏳ useRefValue utility (TODO)
⏳ Integration tests (TODO)
⏳ Performance tests (TODO)
⏳ Example tests (TODO)

**Current Stats: 50/60 tests passing (83%)**

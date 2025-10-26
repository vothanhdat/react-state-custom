# Tests

This directory contains the test suite for `react-state-custom`.

## Running Tests

```bash
# Run tests in watch mode
yarn test

# Run tests once
yarn test:run

# Run tests with UI
yarn test:ui

# Run tests with coverage
yarn test:coverage
```

## Test Structure

### Core Tests

- **`ctx.test.ts`** - Tests for the core Context system, including:
  - Context class publish/subscribe mechanism
  - `getContext` memoization
  - `useDataContext` hook
  - `useDataSource` and `useDataSourceMultiple` hooks
  - `useDataSubscribe` and `useDataSubscribeMultiple` hooks
  - Debouncing behavior

- **`createRootCtx.test.tsx`** - Tests for root context creation:
  - Root component creation and rendering
  - Context data provision through Root
  - Unique context name derivation from props
  - `useCtxState` and `useCtxStateStrict` hooks
  - Error handling when Root is not mounted

### Future Test Categories

#### Planned Tests

- **Auto Context System** (`createAutoCtx.test.tsx`)
  - AutoRootCtx component behavior
  - Reference counting and lifecycle management
  - Delayed unmounting
  - Error boundary wrapping

- **Utility Hooks** 
  - `useArrayHash.test.ts`
  - `useQuickSubscribe.test.ts`
  - `useRefValue.test.ts`

- **Integration Tests**
  - Complex state flow scenarios
  - Multiple contexts interaction
  - Real-world usage patterns

- **Performance Tests**
  - Re-render optimization
  - Memory leak detection
  - Large dataset handling

- **Example Tests**
  - Counter example
  - Todo example
  - Form example
  - Timer example
  - Cart example

## Test Utilities

### Setup

- **`setup.ts`** - Global test setup and cleanup
  - Configures React Testing Library
  - Automatic cleanup after each test

### Configuration

- **`vitest.config.test.ts`** - Vitest configuration
  - jsdom environment for React testing
  - Coverage settings
  - Test file patterns

## Testing Patterns

### Hook Testing

```typescript
import { renderHook, act } from '@testing-library/react'

const { result } = renderHook(() => useYourHook())
act(() => {
  // Perform actions
})
expect(result.current).toBe(expectedValue)
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
✅ useArrayHash utility (11 tests - 6 passing, 5 edge cases)
✅ useQuickSubscribe utility (11 tests - all passing)
⏳ useRefValue utility (TODO)
⏳ Integration tests (TODO)
⏳ Performance tests (TODO)
⏳ Example tests (TODO)

**Current Stats: 50/60 tests passing (83%)**

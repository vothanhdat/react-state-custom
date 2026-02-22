# Changelog

All notable changes to this project are documented here.

## [1.1.0] - 2025-11-30
- Added `StateScopeProvider` component to support isolated nested state scopes.
- Updated `useDataContext` to respect scope context, enabling independent store instances in different parts of the React tree.
- Updated `createRootCtx` to prevent duplicate mount errors when using the same store across multiple scopes.

## [1.0.32] - 2025-11-30
- Added `createStore` helper function to simplify store creation (combines `createRootCtx` and `createAutoCtx` into one step).
- Added `useStore` hook to the return value of `createAutoCtx` and `createStore` for easier, proxy-based state consumption.
- Added documentation for "Composing Stores" pattern (derived state).
- Added `preState` argument to `createRootCtx` hooks so roots can warm-start from previously published data when they remount (helps AutoRootCtx keep state continuity).
- Updated documentation to describe the new `useFn(props, preState)` signature and warm-start behavior.

## [1.0.31] - 2025-11-25
- Last tagged release before this changelog was introduced (see git history for details).

[Unreleased]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.31...HEAD
[1.0.31]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.29...v1.0.31

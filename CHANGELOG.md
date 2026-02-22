# Changelog

All notable changes to this project are documented here.

## [1.0.33] - 2026-02-22
- Added `StateScopeProvider` component for isolated nested state — allows subtrees to mount their own independent store instance, preventing state leakage between siblings or nested consumers.
- Re-exported `StateScopeProvider` from the package entrypoint (`src/index.ts`).
- Rewrote README and API documentation for clarity and impact; fixed example imports and corrected `AutoRootCtx` usage docs.
- Added `AI_CONTEXT.md` with guidelines on preferred patterns and API usage for AI-assisted development.

## [1.0.32] - 2025-11-30
- Added `createStore` helper function to simplify store creation (combines `createRootCtx` and `createAutoCtx` into one step).
- Added `useStore` hook to the return value of `createAutoCtx` and `createStore` for easier, proxy-based state consumption.
- Added documentation for "Composing Stores" pattern (derived state).
- Added `preState` argument to `createRootCtx` hooks so roots can warm-start from previously published data when they remount (helps AutoRootCtx keep state continuity).
- Updated documentation to describe the new `useFn(props, preState)` signature and warm-start behavior.
- Implemented `DependencyTracker` for circular dependency detection; warns at runtime when two stores subscribe to each other in a cycle.

## [1.0.31] - 2025-11-25
- Last tagged release before this changelog was introduced (see git history for details).

[Unreleased]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.33...HEAD
[1.0.33]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.32...v1.0.33
[1.0.32]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.31...v1.0.32
[1.0.31]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.29...v1.0.31

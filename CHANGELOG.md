# Changelog

All notable changes to this project are documented here.

## [Unreleased]
- Added `preState` argument to `createRootCtx` hooks so roots can warm-start from previously published data when they remount (helps AutoRootCtx keep state continuity).
- Updated documentation to describe the new `useFn(props, preState)` signature and warm-start behavior.

## [1.0.31] - 2025-11-25
- Last tagged release before this changelog was introduced (see git history for details).

[Unreleased]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.31...HEAD
[1.0.31]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.29...v1.0.31

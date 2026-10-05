# Trading terminal

A realtime exchange UI built with `react-state-custom`, to see how the library holds up on a
frontend with high-frequency data, cross-store validation and racing async sources.

```bash
yarn demo:trading                                        # http://localhost:3100
npx vitest run --config demos/trading/vitest.config.mjs  # tests: domain, stores, views, architecture
npx tsc -p demos/trading                                 # types
```

## What is in it

- **Simulator** (`src/sim/exchange.ts`): 200 markets, an order book per symbol sent as snapshot +
  sequenced deltas, trades, tickers, candles, an account with balances, a matching engine for limit
  and market orders, request latency, random rejections. The header controls feed speed (1× to 50×,
  up to ~1,100 messages/s), sequence gaps (1% of book messages lost) and connection drops.
- **Layers**: imports only go down, and `tests/architecture.test.ts` fails when one goes up.

  ```
  lib, sim/types   utilities, data contracts
  domain           plain functions: book arithmetic, order rules, valuation. No React, no stores
  stores/core      stores that own IO and data. They know nothing about the UI
  stores/ui        view-models: what the screens render, built from core
  components       views: read stores/ui only, plus their own local state
  ```

  | layer | store or hook | params | notes |
  |---|---|---|---|
  | core | `connection`, `markets`, `tickers`, `feed` | none | tickers publishes one key per symbol, once per frame (`useFrameState`); feed is the simulator's knobs |
  | core | `book` | `symbol` | snapshot + deltas in plain maps, published once per frame (`scheduled(publish, frame())`); resyncs on a sequence gap |
  | core | `trades`, `candles` | `symbol` (+ `interval`) | candles merge REST history with live trades by trade id; refetched after a reconnect |
  | core | `account` | none | balances, orders, fills; snapshot + sequenced events; optimistic orders reconciled by version. Commands return their outcome, fills go out through `onFill(listener)` |
  | ui | `workspace`, `favorites`, `toasts` | none | what the user looks at, preferences, notifications |
  | ui | `fill-toasts` | none | fill → toast; a store so there is one listener however many places start it |
  | ui | `order-form` | `symbol` | the draft; the rules are `checkOrder()` in domain, fed by selectors over core |
  | ui | `ladder` | `symbol, grouping, depth` | ladder rows, spread, last trade and the user's price levels from one store |
  | ui | `portfolio` | none | balances valued at live prices (header and balances table); its readers render at most 4 times a second (`schedule: throttle(250)`) |
  | ui | hooks: `useChart`, `useDepth`, `useTradeTape`, `useWatchlist`, `useOrderRow`, ... | | one reader each, so a hook rather than a store: no extra commit |

- **Update cadence**: core stores publish at most once per frame, whatever the message rate. The
  UI layer decides how often each view follows: the ladder, trades and last price every frame; the
  depth chart `throttle(100)`; equity `throttle(250)`; order history and fills
  `idle(500)`. Against the demo before these schedules and the per-frame tickers (headless
  Chrome, production builds, three alternating runs): script time per second 134/142/139 ms → 132/130/129 ms at 20×,
  201/198/197 ms → 190/190/190 ms at 50×; the depth chart 60 → 10 commits/s; 60 fps and no long
  frames either way. The ladder (24 rows, ~1,400 commits/s) is most of the work, and it stays on
  every frame.
- **UI** (`src/components`): watchlist, canvas candlestick chart with zoom, pan, crosshair and order
  lines, order book ladder (click a level to fill the ticket), depth chart, trades, order ticket,
  open orders, history, fills, balances, toasts. The perf readout in the header shows fps, long
  frames, messages/s and commits per panel.

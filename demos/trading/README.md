# Trading terminal

A realtime exchange UI built with `react-state-custom`, to see how the library holds up on a
frontend with high-frequency data, cross-store validation and racing async sources.

```bash
yarn demo:trading                                        # http://localhost:3100
npx vitest run --config demos/trading/vitest.config.mjs  # tests
npx tsc -p demos/trading                                 # types
```

## What is in it

- **Simulator** (`src/sim/exchange.ts`): 200 markets, an order book per symbol sent as snapshot +
  sequenced deltas, trades, tickers, candles, an account with balances, a matching engine for limit
  and market orders, request latency, random rejections. The header controls feed speed (1× to 50×,
  up to ~1,100 messages/s), sequence gaps (1% of book messages lost) and connection drops.
- **Stores** (`src/stores`): one per owner of data or IO.

  | store | params | notes |
  |---|---|---|
  | `connection`, `markets`, `tickers`, `workspace`, `favorites`, `toasts` | none | app-wide; tickers publishes one key per symbol |
  | `book` | `symbol` | snapshot + deltas in plain maps, published once per frame; resyncs on a sequence gap |
  | `book-view` | `symbol, grouping, depth` | grouped ladder rows, derived from `book` |
  | `trades` | `symbol` | last 60 trades, once per frame |
  | `candles` | `symbol, interval` | history over REST merged with live trades by trade id; refetched after a reconnect |
  | `account` | none | balances, orders, fills; snapshot + sequenced events; optimistic orders reconciled by version |
  | `order-form` | `symbol` | the ticket; validation reads markets, account (minus in-flight orders), book and trades through selectors |
  | `portfolio` | none | balances valued at live prices |

- **UI** (`src/components`): watchlist, canvas candlestick chart with zoom, pan, crosshair and order
  lines, order book ladder (click a level to fill the ticket), depth chart, trades, order ticket,
  open orders, history, fills, balances, toasts. The perf readout in the header shows fps, long
  frames, messages/s and commits per panel.

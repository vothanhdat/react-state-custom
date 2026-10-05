import { fmt, fmtCompact, fmtPct, fmtUsd } from '../lib/format'
import { usePortfolio } from '../stores/ui/accountViews'
import { useConnectionStatus, useFeedControls, useLastTrade, useSymbolSummary } from '../stores/ui/header'
import { useWorkspace } from '../stores/ui/workspace'
import { PerfHud, useCommitCounter } from './Perf'

export function Header() {
  const { symbol } = useWorkspace()
  return (
    <header className="header">
      <div className="brand">◆ Terminal</div>
      {symbol && <SymbolSummary symbol={symbol} />}
      <div className="spacer" />
      <Equity />
      <Connection />
      <SimControls />
      <PerfHud />
    </header>
  )
}

function SymbolSummary({ symbol }: { symbol: string }) {
  useCommitCounter('header')
  const { base, decimals, change, high, low, volume } = useSymbolSummary(symbol)
  return (
    <div className="summary">
      <div className="summary-symbol">{symbol}</div>
      <LastPrice symbol={symbol} decimals={decimals} />
      <Stat label="24h change" className={change === undefined ? '' : change >= 0 ? 'pos' : 'neg'}>{fmtPct(change)}</Stat>
      <Stat label="24h high">{fmt(high, decimals)}</Stat>
      <Stat label="24h low">{fmt(low, decimals)}</Stat>
      <Stat label={`24h vol (${base})`}>{fmtCompact(volume)}</Stat>
    </div>
  )
}

/** The last trade, at trade speed: its own component so nothing else re-renders with it */
function LastPrice({ symbol, decimals }: { symbol: string; decimals: number }) {
  useCommitCounter('last price')
  const { lastPrice, direction } = useLastTrade(symbol)
  return <div className={`summary-last ${direction === 'up' ? 'pos' : direction === 'down' ? 'neg' : ''}`}>{fmt(lastPrice, decimals)}</div>
}

function Stat({ label, className = '', children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${className}`}>{children}</div>
    </div>
  )
}

function Equity() {
  useCommitCounter('equity')
  const { equity, change24h } = usePortfolio()
  return (
    <div className="stat">
      <div className="stat-label">Equity (USD)</div>
      <div className="stat-value">
        {fmtUsd(equity)} <small className={change24h === undefined ? '' : change24h >= 0 ? 'pos' : 'neg'}>{fmtPct(change24h)}</small>
      </div>
    </div>
  )
}

function Connection() {
  const { status } = useConnectionStatus()
  return <div className={`pill pill-${status}`}>{status === 'open' ? 'live' : status}</div>
}

const SPEEDS = [1, 5, 20, 50]

function SimControls() {
  const { speed, chaos, setSpeed, setChaos, canDrop, drop } = useFeedControls()
  return (
    <div className="sim">
      <span className="sim-label">feed</span>
      {SPEEDS.map(s => (
        <button key={s} className={speed === s ? 'on' : ''} onClick={() => setSpeed?.(s)}>{s}×</button>
      ))}
      <button
        className={chaos ? 'on warn' : ''}
        title="Drop 1% of book messages so the client has to detect the gap and resync"
        onClick={() => setChaos?.(!chaos)}
      >gaps</button>
      <button disabled={!canDrop} onClick={drop} title="Drop the connection for two seconds">drop</button>
    </div>
  )
}

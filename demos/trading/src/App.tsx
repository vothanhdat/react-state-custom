import { AutoRootCtx } from 'react-state-custom'
import { DevToolContainer } from 'react-state-custom/dev-tool'
import 'react-state-custom/style.css'
import { AccountPanel } from './components/AccountPanel'
import { ChartPanel } from './components/Chart'
import { DepthChart } from './components/DepthChart'
import { Header } from './components/Header'
import { OrderBook, Trades } from './components/OrderBook'
import { OrderTicket } from './components/OrderForm'
import { PanelBoundary } from './components/PanelBoundary'
import { Toasts } from './components/Toasts'
import { Watchlist } from './components/Watchlist'

export function App() {
  return (
    <>
      <AutoRootCtx />
      <div className="app">
        <PanelBoundary name="Header" className="header"><Header /></PanelBoundary>
        <PanelBoundary name="Watchlist" className="watchlist"><Watchlist /></PanelBoundary>
        <PanelBoundary name="Chart" className="chart-panel"><ChartPanel /></PanelBoundary>
        <PanelBoundary name="Account" className="account"><AccountPanel /></PanelBoundary>
        <PanelBoundary name="Order book" className="book"><OrderBook /></PanelBoundary>
        <PanelBoundary name="Trades" className="trades"><Trades /></PanelBoundary>
        <PanelBoundary name="Order ticket" className="ticket"><OrderTicket /></PanelBoundary>
        <PanelBoundary name="Depth" className="depth"><DepthChart /></PanelBoundary>
      </div>
      <PanelBoundary name="Notifications" className="toasts"><Toasts /></PanelBoundary>
      {import.meta.env.DEV && <DevToolContainer style={{ left: 12, bottom: 12, right: 'auto' }}>State</DevToolContainer>}
    </>
  )
}

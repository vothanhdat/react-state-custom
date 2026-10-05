import { AutoRootCtx } from 'react-state-custom'
import { DevToolContainer } from 'react-state-custom/dev-tool'
import 'react-state-custom/style.css'
import { AccountPanel } from './components/AccountPanel'
import { ChartPanel } from './components/Chart'
import { DepthChart } from './components/DepthChart'
import { Header } from './components/Header'
import { OrderBook, Trades } from './components/OrderBook'
import { OrderTicket } from './components/OrderForm'
import { Toasts } from './components/Toasts'
import { Watchlist } from './components/Watchlist'

export function App() {
  return (
    <>
      <AutoRootCtx />
      <div className="app">
        <Header />
        <Watchlist />
        <ChartPanel />
        <AccountPanel />
        <OrderBook />
        <Trades />
        <OrderTicket />
        <DepthChart />
      </div>
      <Toasts />
      {import.meta.env.DEV && <DevToolContainer style={{ left: 12, bottom: 12, right: 'auto' }}>State</DevToolContainer>}
    </>
  )
}

import { fmt, fmtUsd } from '../lib/format'
import { useWorkspace } from '../stores/app'
import { useOrderForm } from '../stores/orderForm'
import { useTrades } from '../stores/market'
import { useCommitCounter } from './Perf'

export function OrderTicket() {
  const { symbol } = useWorkspace()
  return (
    <section className="panel ticket">
      <OrderForm symbol={symbol} />
    </section>
  )
}

function OrderForm({ symbol }: { symbol: string }) {
  useCommitCounter('order form')
  const {
    market, side, type, price, size, total, driver,
    priceError, sizeError, totalError, balanceError, warning, serverError,
    estimate, available, availableAsset, fee, canSubmit, submitting,
    setSide, setType, setPrice, setSize, setTotal, touch, fillLastPrice, setPercent, submit,
  } = useOrderForm({ symbol })

  if (!market) return <div className="empty">Loading market…</div>
  const limit = type === 'limit'

  return (
    <form
      className={`ticket-form ${side}`}
      noValidate
      onSubmit={e => { e.preventDefault(); void submit?.() }}
    >
      <div className="segmented sides">
        <button type="button" className={side === 'buy' ? 'on buy' : ''} onClick={() => setSide?.('buy')}>Buy</button>
        <button type="button" className={side === 'sell' ? 'on sell' : ''} onClick={() => setSide?.('sell')}>Sell</button>
      </div>
      <div className="tabs small">
        <button type="button" className={limit ? 'on' : ''} onClick={() => setType?.('limit')}>Limit</button>
        <button type="button" className={!limit ? 'on' : ''} onClick={() => setType?.('market')}>Market</button>
        <span className="spacer" />
        <span className="muted">Avail {fmt(available, availableAsset === market.quote ? 2 : market.sizeDecimals)} {availableAsset}</span>
      </div>

      {limit ? (
        <Field label="Price" unit={market.quote} error={priceError}>
          <input
            inputMode="decimal"
            value={price ?? ''}
            onChange={e => setPrice?.(e.target.value)}
            onBlur={() => touch?.('price')}
            aria-invalid={!!priceError}
          />
          <button type="button" className="field-btn" onClick={fillLastPrice} title="Use the last trade price">Last</button>
        </Field>
      ) : (
        <Field label="Price" unit={market.quote}>
          <input disabled value={estimate ? `≈ ${fmt(estimate.avgPrice, market.priceDecimals)}` : 'Market'} />
        </Field>
      )}

      <Field label="Amount" unit={market.base} error={sizeError}>
        <input
          inputMode="decimal"
          value={size ?? ''}
          onChange={e => setSize?.(e.target.value)}
          onBlur={() => touch?.('size')}
          aria-invalid={!!sizeError && driver === 'size'}
          placeholder={`step ${market.stepSize}`}
        />
      </Field>

      <div className="percent">
        {[0.25, 0.5, 0.75, 1].map(p => (
          <button type="button" key={p} onClick={() => setPercent?.(p)}>{p * 100}%</button>
        ))}
      </div>

      <Field label={limit ? 'Total' : 'Est. total'} unit={market.quote} error={totalError}>
        <input
          inputMode="decimal"
          value={total ?? ''}
          disabled={!limit}
          onChange={e => setTotal?.(e.target.value)}
          onBlur={() => touch?.('total')}
          aria-invalid={!!totalError}
          placeholder={`min ${market.minNotional}`}
        />
      </Field>

      <div className="ticket-info">
        <span>Fee (0.1%)</span><span className="num">{fee === undefined ? '—' : `${fmtUsd(fee)} ${market.quote}`}</span>
        {!limit && estimate && <>
          <span>Worst price</span><span className="num">{fmt(estimate.worstPrice, market.priceDecimals)}</span>
        </>}
        <span>Last</span><span className="num"><LastPrice symbol={symbol} decimals={market.priceDecimals} /></span>
      </div>

      {balanceError && <div className="alert error">{balanceError}</div>}
      {warning && <div className="alert warn">{warning}</div>}
      {serverError && <div className="alert error" role="alert">Rejected: {serverError}</div>}

      <button type="submit" className={`submit ${side}`} disabled={submitting} aria-disabled={!canSubmit}>
        {submitting ? 'Sending…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${market.base}`}
      </button>
    </form>
  )
}

function Field({ label, unit, error, children }: { label: string; unit: string; error?: string; children: React.ReactNode }) {
  return (
    <label className={`field ${error ? 'invalid' : ''}`}>
      <span className="field-label">{label}</span>
      <span className="field-input">
        {children}
        <span className="field-unit">{unit}</span>
      </span>
      {error && <span className="field-error">{error}</span>}
    </label>
  )
}

/** Reads the last price at trade speed, so the rest of the form does not */
function LastPrice({ symbol, decimals }: { symbol: string; decimals: number }) {
  const { lastPrice } = useTrades({ symbol })
  return <>{fmt(lastPrice, decimals)}</>
}

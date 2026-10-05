const formatters = new Map<string, Intl.NumberFormat>()

const formatter = (min: number, max: number, compact = false) => {
  const key = `${min}:${max}:${compact}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      notation: compact ? 'compact' : 'standard',
    })
    formatters.set(key, f)
  }
  return f
}

export const fmt = (value: number | undefined, decimals: number) =>
  value === undefined || !Number.isFinite(value) ? '—' : formatter(decimals, decimals).format(value)

export const fmtUsd = (value: number | undefined) => fmt(value, 2)

export const fmtCompact = (value: number | undefined) =>
  value === undefined ? '—' : formatter(0, 2, true).format(value)

export const fmtPct = (value: number | undefined) =>
  value === undefined || !Number.isFinite(value) ? '—' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`

export const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('en-GB', { hour12: false })

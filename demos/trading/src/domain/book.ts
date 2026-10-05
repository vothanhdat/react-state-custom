// Order book arithmetic. Plain functions: no React, no stores.

import { decimalsOf, roundTo } from '../lib/num'
import type { Level } from '../sim/types'

/** Applies levels to one side of a book kept in a map; a size of 0 removes the level */
export const applyLevels = (side: Map<number, number>, levels: readonly Level[]) => {
  for (const [price, size] of levels) {
    if (size > 0) side.set(price, size)
    else side.delete(price)
  }
}

export const sortLevels = (side: Map<number, number>, descending: boolean): Level[] =>
  [...side].sort((a, b) => (descending ? b[0] - a[0] : a[0] - b[0]))

/** The ladder row a price falls in: bids round down, asks round up, so a row never crosses the spread */
export const bucketOf = (price: number, grouping: number, side: 'bid' | 'ask') => {
  const steps = price / grouping
  return roundTo((side === 'bid' ? Math.floor(steps + 1e-9) : Math.ceil(steps - 1e-9)) * grouping, decimalsOf(grouping))
}

export type BookRow = { price: number; size: number; total: number; mine: boolean }

/** Groups levels into `depth` rows of `grouping`, with the running total; `mine` marks rows holding one of the user's prices */
export const groupLevels = (
  levels: readonly Level[] | undefined,
  grouping: number,
  side: 'bid' | 'ask',
  depth: number,
  sizeDecimals: number,
  mine: readonly number[] = [],
): BookRow[] => {
  const rows: BookRow[] = []
  if (!levels) return rows
  let total = 0
  for (const [price, size] of levels) {
    const bucket = bucketOf(price, grouping, side)
    total += size
    const last = rows[rows.length - 1]
    if (last && last.price === bucket) {
      last.size = roundTo(last.size + size, sizeDecimals)
      last.total = roundTo(total, sizeDecimals)
      continue
    }
    if (rows.length === depth) break
    rows.push({ price: bucket, size, total: roundTo(total, sizeDecimals), mine: mine.includes(bucket) })
  }
  return rows
}

export type Estimate = { filled: number; cost: number; avgPrice: number; worstPrice: number; slippage: number }

/** Walks one side of the book to price a market order of `size` */
export const estimateFill = (levels: readonly Level[] | undefined, size: number): Estimate | undefined => {
  const best = levels?.[0]?.[0]
  if (!levels || best === undefined) return undefined
  let filled = 0
  let cost = 0
  let worstPrice = best
  for (const [price, available] of levels) {
    if (filled >= size) break
    const qty = Math.min(available, size - filled)
    filled += qty
    cost += qty * price
    worstPrice = price
  }
  const avgPrice = filled > 0 ? cost / filled : best
  return { filled, cost, avgPrice, worstPrice, slippage: Math.abs(avgPrice / best - 1) }
}

/** Cumulative size from the best price outwards, while `inside(price)`: [price, total][] */
export const cumulate = (levels: readonly Level[] | undefined, inside: (price: number) => boolean): [number, number][] => {
  const out: [number, number][] = []
  let total = 0
  for (const [price, size] of levels ?? []) {
    if (!inside(price)) break
    total += size
    out.push([price, total])
  }
  return out
}

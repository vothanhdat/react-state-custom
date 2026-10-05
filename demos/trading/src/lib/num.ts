/** Number of decimals a step such as 0.001 or 1e-5 needs */
export const decimalsOf = (step: number): number => {
  const text = step.toString()
  const exp = text.match(/e-(\d+)$/)
  if (exp) return Number(exp[1])
  const dot = text.indexOf('.')
  return dot < 0 ? 0 : text.length - dot - 1
}

export const roundTo = (value: number, decimals: number): number => Number(value.toFixed(decimals))

/** Rounds down to a multiple of step, without the float drift of Math.floor(value / step) * step */
export const floorToStep = (value: number, step: number): number =>
  roundTo(Math.floor(value / step + 1e-9) * step, decimalsOf(step))

export const roundToStep = (value: number, step: number): number =>
  roundTo(Math.round(value / step) * step, decimalsOf(step))

export const isMultipleOf = (value: number, step: number): boolean => {
  const ratio = value / step
  return Math.abs(ratio - Math.round(ratio)) < 1e-7
}

/** Parses user input: '' and anything that is not a finite number give undefined */
export const parseNum = (text: string): number | undefined => {
  if (text.trim() === '') return undefined
  const value = Number(text)
  return Number.isFinite(value) ? value : undefined
}

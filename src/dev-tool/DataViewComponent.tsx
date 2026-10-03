import React, { useMemo } from "react"
import { formatState } from "../state-utils/utils"

/** Renders one store's value in the dev tool. `name` is the full context name, `value` the current data. */
export type DataViewComponent = React.FC<{ value: any; name: string; }>

/** Default renderer: the value as JSON text (functions, undefined, bigint and cycles included). */
export const DataViewDefault: DataViewComponent = ({ value }) => {
    const text = useMemo(() => formatState(value), [value])
    return <pre className="state-json">{text}</pre>
}

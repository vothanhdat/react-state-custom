import { ObjectView } from "react-obj-view"
import type { DataViewComponent } from "./DataViewComponent"

/**
 * A dev tool `Component` that renders values with react-obj-view's expandable tree.
 * Lives in its own entry (`react-state-custom/dev-tool/obj-view`) because it needs the optional
 * peer dependency `react-obj-view`; import its stylesheet too:
 *
 *   import { ObjectDataView } from 'react-state-custom/dev-tool/obj-view'
 *   import 'react-obj-view/dist/react-obj-view.css'
 *   <DevToolContainer Component={ObjectDataView} />
 */
export const ObjectDataView: DataViewComponent = ({ name, value }) => (
    <ObjectView valueGetter={() => value} name={name} expandLevel={5} showLineNumbers includeSymbols />
)

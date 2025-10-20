import { createRoot } from 'react-dom/client'
import { DevToolContainer } from './DevTool'
import { AutoRootCtx, createAutoCtx } from './state-utils/createAutoCtx'
import { Test } from './Test'



createRoot(document.getElementById('root')!).render(
  <>
    <DevToolContainer />
    <Test/>
    <AutoRootCtx/>
  </>
)

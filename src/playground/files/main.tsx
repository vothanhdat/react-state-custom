import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AutoRootCtx } from 'react-state-custom'
import App from './App.tsx'

import { DevToolToggleBtn } from './dev-tool.tsx'


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <AutoRootCtx />
    <DevToolToggleBtn />
  </StrictMode>,
)
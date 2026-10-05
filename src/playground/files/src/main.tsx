import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AutoRootCtx } from 'react-state-custom'
import App from './App.tsx'
import './examples.css'

import { DevToolToggleBtn } from './dev-tool.tsx'
import { ErrorWrapper } from './error-wrapper.tsx'


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AutoRootCtx />
    <ErrorWrapper>
      <App />
      <DevToolToggleBtn />
    </ErrorWrapper>
  </StrictMode>,
)
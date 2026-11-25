import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { captureOnelinkCallback } from './utils/OnelinkLoginFlow'
import { installVideoControlDragGuard } from './utils/VideoControlDragGuard'

const onelinkCallback = captureOnelinkCallback(window)

const disposeVideoDragGuard = installVideoControlDragGuard()
if (import.meta.hot) import.meta.hot.dispose(disposeVideoDragGuard)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App onelinkCallback={onelinkCallback} />
  </StrictMode>,
)

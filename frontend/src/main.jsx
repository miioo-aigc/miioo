import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installVideoControlDragGuard } from './utils/VideoControlDragGuard'

const disposeVideoDragGuard = installVideoControlDragGuard()
if (import.meta.hot) import.meta.hot.dispose(disposeVideoDragGuard)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import Home from './pages/Home'
import LiveMaterialAuthCallbackPage from './pages/LiveMaterialAuthCallbackPage'
import LiquidGlassDefs from './components/LiquidGlassDefs'

function App() {
  const pathname = window.location.pathname
  const isLiveMaterialCallback = pathname === '/live-material-auth/callback'

  return (
    <>
      <LiquidGlassDefs />
      {isLiveMaterialCallback ? <LiveMaterialAuthCallbackPage /> : <Home />}
    </>
  )
}

export default App

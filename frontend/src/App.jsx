import { lazy, Suspense, useState, useCallback } from 'react'
const Home = lazy(() => import('./pages/Home'))
const AdminConsolePage = lazy(() => import('./pages/AdminConsolePage'))
import LiquidGlassDefs from './components/LiquidGlassDefs'
import GlobalToast from './components/feedback/GlobalToast'
import { showGlobalToast } from './stores/toastStore'
import { apiGetCurrentUser } from './api/user'

function App() {
  const [adminView, setAdminView] = useState(false)
  const [adminUser, setAdminUser] = useState(null)
  const showToast = useCallback((msg, type = 'warning', duration) => {
    showGlobalToast(msg, type, duration)
  }, [])

  const handleGoToAdmin = useCallback(async () => {
    try {
      const user = await apiGetCurrentUser()
      setAdminUser(user)
    } catch {
      // Ignore fetch error and proceed with empty user
    }
    setAdminView(true)
  }, [])

  const handleBackHome = useCallback(() => {
    setAdminView(false)
  }, [])

  if (adminView) {
    return (
      <>
        <LiquidGlassDefs />
        <Suspense fallback={null}>
          <AdminConsolePage
            currentUser={adminUser}
            onBackHome={handleBackHome}
            showToast={showToast}
          />
        </Suspense>
        <GlobalToast />
      </>
    )
  }

  return (
    <>
      <LiquidGlassDefs />
      <Suspense fallback={null}>
        <Home onProjectCreated={() => {}} onGoToAdmin={handleGoToAdmin} />
      </Suspense>
      <GlobalToast />
    </>
  )
}

export default App

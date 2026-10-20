import { lazy, Suspense, useState, useCallback } from 'react'
const Home = lazy(() => import('./pages/Home'))
const CompositionEditorPage = lazy(() => import('./pages/CompositionEditorPage'))
const AdminConsolePage = lazy(() => import('./pages/AdminConsolePage'))
const SharedCanvasPage = lazy(() => import('./pages/SharedCanvasPage'))
import { parseCanvasShareRoute } from './components/canvas/CanvasShareLink'
import LiquidGlassDefs from './components/LiquidGlassDefs'
import GlobalToast from './components/feedback/GlobalToast'
import VideoEditNotice from './components/video-edit/VideoEditNotice'
import { showGlobalToast } from './stores/toastStore'
import { apiGetCurrentUser } from './api/user'

function App() {
  const shareRoute = parseCanvasShareRoute(window.location.pathname)
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
        <VideoEditNotice />
      </>
    )
  }

  return (
    <>
      <LiquidGlassDefs />
      <Suspense fallback={null}>
        {shareRoute ? (
          <SharedCanvasPage token={shareRoute.token} />
        ) : window.location.pathname.replace(/\/+$/, '') === '/editor' ? (
          <CompositionEditorPage />
        ) : (
          <Home onProjectCreated={() => {}} onGoToAdmin={handleGoToAdmin} />
        )}
      </Suspense>
      <GlobalToast />
      <VideoEditNotice />
    </>
  )
}

export default App

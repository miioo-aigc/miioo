import { lazy, Suspense, useState, useCallback, useRef } from 'react'
const Home = lazy(() => import('./pages/Home'))
const CompositionEditorPage = lazy(() => import('./pages/CompositionEditorPage'))
const AdminConsolePage = lazy(() => import('./pages/AdminConsolePage'))
const SharedCanvasPage = lazy(() => import('./pages/SharedCanvasPage'))
import { parseCanvasShareRoute } from './components/canvas/CanvasShareLink'
import LiquidGlassDefs from './components/LiquidGlassDefs'
import GlobalToast from './components/feedback/GlobalToast'
import AppPageBoundary from './components/feedback/AppPageBoundary'
import VideoEditNotice from './components/video-edit/VideoEditNotice'
import { showGlobalToast } from './stores/toastStore'
import { apiGetCurrentUser } from './api/user'
import { getAuthSessionGeneration } from './api/request'

function App() {
  const shareRoute = parseCanvasShareRoute(window.location.pathname)
  const [adminView, setAdminView] = useState(false)
  const [adminUser, setAdminUser] = useState(null)
  const adminRequestRef = useRef(null)
  const showToast = useCallback((msg, type = 'warning', duration) => {
    showGlobalToast(msg, type, duration)
  }, [])

  const handleGoToAdmin = useCallback(async () => {
    const generation = getAuthSessionGeneration()
    if (adminRequestRef.current?.generation === generation) return
    const request = { generation }
    adminRequestRef.current = request
    const isCurrent = () => adminRequestRef.current === request
      && getAuthSessionGeneration() === generation
    setAdminUser(null)
    try {
      const user = await apiGetCurrentUser()
      if (!isCurrent()) return
      if (!user || typeof user.id !== 'string' || !user.id.trim()) {
        throw new Error('身份响应缺少用户编号')
      }
      setAdminUser(user)
      setAdminView(true)
    } catch {
      if (isCurrent()) showToast('身份读取失败，请重试', 'error')
    } finally {
      // 旧账号请求结束时不能释放新账号的请求锁。
      if (adminRequestRef.current === request) adminRequestRef.current = null
    }
  }, [showToast])

  const handleBackHome = useCallback(() => {
    setAdminView(false)
  }, [])

  if (adminView) {
    return (
      <>
        <LiquidGlassDefs />
        <AppPageBoundary key="admin">
          <AdminConsolePage
            currentUser={adminUser}
            onBackHome={handleBackHome}
            showToast={showToast}
          />
        </AppPageBoundary>
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
          <AppPageBoundary key="home">
            <Home onProjectCreated={() => {}} onGoToAdmin={handleGoToAdmin} />
          </AppPageBoundary>
        )}
      </Suspense>
      <GlobalToast />
      <VideoEditNotice />
    </>
  )
}

export default App

import { lazy, Suspense, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
const Home = lazy(() => import('./pages/Home'))
const AdminConsolePage = lazy(() => import('./pages/AdminConsolePage'))
import LiquidGlassDefs from './components/LiquidGlassDefs'
import { apiGetCurrentUser } from './api/user'

function App() {
  const [adminView, setAdminView] = useState(false)
  const [adminUser, setAdminUser] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)

  const showToast = useCallback((msg, type = 'warning') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ msg, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 2500)
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
        {toast && createPortal(
          <div style={{
            position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
            zIndex: 200,
          }}>
            <div className="flex items-center gap-[8px] px-[16px] py-[8px] rounded-medium bg-toast-bg backdrop-blur-[20px]">
              {toast.type === 'success' && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8L6.5 11.5L13 5" stroke="#6DD98E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {toast.type === 'error' && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="#EE6B6B" strokeWidth="1.5"/>
                  <path d="M8 5V8.5M8 11.5H8.005" stroke="#EE6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              <span className="text-font-size-14 text-text-primary">{toast.msg}</span>
            </div>
          </div>,
          document.body
        )}
      </>
    )
  }

  return (
    <>
      <LiquidGlassDefs />
      <Suspense fallback={null}>
        <Home onProjectCreated={() => {}} onGoToAdmin={handleGoToAdmin} />
      </Suspense>
    </>
  )
}

export default App

import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Home from './pages/Home'
import AdminConsolePage from './pages/AdminConsolePage'
import LiquidGlassDefs from './components/LiquidGlassDefs'
import { apiGetCurrentUser } from './api/user'
import LoadingAnimation from './components/LoadingAnimation'

// ⚠️ 预览用，看完删掉这段 + 下面 if (PREVIEW) return ...（选优后把 PREVIEW 改回 false）
const PREVIEW = false

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

  // ⚠️ 预览模式：A=现版 loading01 / B=连贯版 loading01b，并排对比选优
  if (PREVIEW) {
    const Demo = ({ label, hint, src }) => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <p style={{ color: '#cfcfcf', fontSize: 14, fontWeight: 600, margin: 0 }}>{label}</p>
        <p style={{ color: '#777', fontSize: 12, margin: '-8px 0 4px' }}>{hint}</p>
        <LoadingAnimation introSrc={src} />
        <LoadingAnimation introSrc={src} width="480px" />
        <div style={{ width: '100%', maxWidth: 480 }}>
          <LoadingAnimation introSrc={src} width="100%" />
        </div>
      </div>
    )
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0d0d0f',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 56,
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '56px 24px',
      }}>
        <Demo label="A · loading01（现版）" hint="dot 从右上飞入、左侧出框" src="/loading01.svg" />
        <Demo label="B · loading01b（连贯版）" hint="dot 从右飞入、落左下接住 loading02" src="/loading01b.svg" />
      </div>
    )
  }

  if (adminView) {
    return (
      <>
        <LiquidGlassDefs />
        <AdminConsolePage
          currentUser={adminUser}
          onBackHome={handleBackHome}
          showToast={showToast}
        />
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
      <Home onProjectCreated={() => {}} onGoToAdmin={handleGoToAdmin} />
    </>
  )
}

export default App

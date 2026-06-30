const FONT = "'Alibaba PuHuiTi 2.0', system-ui, sans-serif"

const ACCENT_GRADIENT = 'linear-gradient(157.78deg, rgba(122,229,185,0.30) 2.88%, rgba(122,229,185,0) 56.77%)'
const PRIMARY_OUTER_GRADIENT = 'linear-gradient(148.76deg, rgba(171,255,255,0.30) 3.64%, rgba(45,195,225,0) 42.81%), linear-gradient(rgba(255,255,255,0.08))'

function Spinner({ color }) {
  return (
    <svg
      style={{ width: 16, height: 16, flexShrink: 0, animation: 'spin 1s linear infinite' }}
      xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    >
      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke={color} strokeWidth="4" />
      <path style={{ opacity: 0.75 }} fill={color} d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

function PlusIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M8 3v10M3 8h10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function TrashIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5L11 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Interactive buttons (real hover/active via CSS) ──────────────────────────

function AccentBtnInteractive({ label }) {
  return (
    <>
      <style>{`
        .btn-accent {
          display: flex; align-items: center; gap: 4px;
          height: 36px; padding: 0 16px; border-radius: 8px;
          background-color: #2DC3E1;
          background-image: ${ACCENT_GRADIENT};
          border: 1px solid rgba(255,255,255,0.20);
          outline: 1px solid rgba(0,0,0,0.50); outline-offset: 0;
          cursor: pointer; flex-shrink: 0; font-family: ${FONT};
        }
        .btn-accent:hover { background-color: #53D3ED; }
        .btn-accent:active { background-color: #139EBA; }
      `}</style>
      <button className="btn-accent">
        <PlusIcon color="#090909" />
        <span style={{ fontSize: 14, fontWeight: 500, color: '#090909', whiteSpace: 'nowrap' }}>{label}</span>
      </button>
    </>
  )
}

function AccentBtnDisabled({ label }) {
  return (
    <button disabled style={{
      display: 'flex', alignItems: 'center', gap: 4,
      height: 36, padding: '0 16px', borderRadius: 8,
      backgroundColor: 'rgba(45,195,225,0.40)',
      backgroundImage: ACCENT_GRADIENT,
      border: '1px solid transparent',
      outline: '1px solid rgba(0,0,0,0.50)', outlineOffset: 0,
      cursor: 'not-allowed', flexShrink: 0, fontFamily: FONT,
    }}>
      <PlusIcon color="rgba(9,9,9,0.30)" />
      <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(9,9,9,0.30)', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

function AccentBtnLoading({ label }) {
  return (
    <button disabled style={{
      display: 'flex', alignItems: 'center', gap: 4,
      height: 36, padding: '0 16px', borderRadius: 8,
      backgroundColor: '#2DC3E1', backgroundImage: ACCENT_GRADIENT,
      border: '1px solid rgba(255,255,255,0.20)',
      outline: '1px solid rgba(0,0,0,0.50)', outlineOffset: 0,
      cursor: 'not-allowed', flexShrink: 0, fontFamily: FONT,
    }}>
      <Spinner color="#090909" />
      <span style={{ fontSize: 14, fontWeight: 500, color: '#090909', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

// ─── Primary ─────────────────────────────────────────────────────────────────

function PrimaryBtnInteractive({ label }) {
  return (
    <>
      <style>{`
        .btn-primary-outer {
          display: flex; flex-direction: column; align-items: stretch;
          height: 36px; border-radius: 8px;
          background-image: ${PRIMARY_OUTER_GRADIENT};
          border: none;
          outline: 1px solid rgba(0,0,0,0.50); outline-offset: 0;
          padding: 1px; cursor: pointer; flex-shrink: 0;
          box-shadow: 3px 3px 8px rgba(0,0,0,0.40);
          font-family: ${FONT};
        }
        .btn-primary-inner {
          display: flex; align-items: center; gap: 4px;
          padding: 0 15px; border-radius: 7px; flex: 1;
          background-color: #161616;
        }
        .btn-primary-outer:hover .btn-primary-inner { background-color: #1D1E1E; }
        .btn-primary-outer:active .btn-primary-inner { background-color: #161616; }
      `}</style>
      <button className="btn-primary-outer">
        <div className="btn-primary-inner">
          <PlusIcon color="#FFFFFF" />
          <span style={{ fontSize: 14, fontWeight: 400, color: '#FFFFFF', whiteSpace: 'nowrap' }}>{label}</span>
        </div>
      </button>
    </>
  )
}

function PrimaryBtnDisabled({ label }) {
  return (
    <button disabled style={{
      display: 'flex', flexDirection: 'column', alignItems: 'stretch',
      height: 36, borderRadius: 8,
      backgroundImage: 'none', backgroundColor: 'rgba(0,0,0,0.10)',
      border: 'none',
      outline: '1px solid rgba(0,0,0,0.50)', outlineOffset: 0,
      padding: 1, cursor: 'not-allowed', flexShrink: 0, fontFamily: FONT,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '0 15px', borderRadius: 7, flex: 1,
        backgroundColor: 'rgba(0,0,0,0.10)',
      }}>
        <PlusIcon color="rgba(255,255,255,0.20)" />
        <span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.20)', whiteSpace: 'nowrap' }}>{label}</span>
      </div>
    </button>
  )
}

function PrimaryBtnLoading({ label }) {
  return (
    <button disabled style={{
      display: 'flex', flexDirection: 'column', alignItems: 'stretch',
      height: 36, borderRadius: 8,
      backgroundImage: PRIMARY_OUTER_GRADIENT,
      border: 'none',
      outline: '1px solid rgba(0,0,0,0.50)', outlineOffset: 0,
      padding: 1, cursor: 'not-allowed', flexShrink: 0,
      boxShadow: '3px 3px 8px rgba(0,0,0,0.40)', fontFamily: FONT,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '0 15px', borderRadius: 7, flex: 1,
        backgroundColor: '#161616',
      }}>
        <Spinner color="#FFFFFF" />
        <span style={{ fontSize: 14, fontWeight: 400, color: '#FFFFFF', whiteSpace: 'nowrap' }}>{label}</span>
      </div>
    </button>
  )
}

// ─── Secondary ───────────────────────────────────────────────────────────────

function SecondaryBtnInteractive({ label }) {
  return (
    <>
      <style>{`
        .btn-secondary {
          display: flex; align-items: center; gap: 4px;
          height: 36px; padding: 0 16px; border-radius: 8px;
          background-color: #161616;
          border: 1px solid rgba(255,255,255,0.05);
          outline: 1px solid rgba(0,0,0,0.50); outline-offset: 0;
          cursor: pointer; flex-shrink: 0;
          box-shadow: 3px 3px 8px rgba(0,0,0,0.40);
          font-family: ${FONT};
        }
        .btn-secondary:hover { background-color: #1D1E1E; }
        .btn-secondary:active { background-color: #161616; }
      `}</style>
      <button className="btn-secondary">
        <PlusIcon color="#FFFFFF" />
        <span style={{ fontSize: 14, fontWeight: 400, color: '#FFFFFF', whiteSpace: 'nowrap' }}>{label}</span>
      </button>
    </>
  )
}

function SecondaryBtnDisabled({ label }) {
  return (
    <button disabled style={{
      display: 'flex', alignItems: 'center', gap: 4,
      height: 36, padding: '0 16px', borderRadius: 8,
      backgroundColor: 'rgba(0,0,0,0.10)',
      border: '1px solid transparent',
      outline: '1px solid rgba(0,0,0,0.50)', outlineOffset: 0,
      cursor: 'not-allowed', flexShrink: 0, fontFamily: FONT,
    }}>
      <PlusIcon color="rgba(255,255,255,0.20)" />
      <span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.20)', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

function SecondaryBtnLoading({ label }) {
  return (
    <button disabled style={{
      display: 'flex', alignItems: 'center', gap: 4,
      height: 36, padding: '0 16px', borderRadius: 8,
      backgroundColor: '#161616',
      border: '1px solid rgba(255,255,255,0.05)',
      outline: '1px solid rgba(0,0,0,0.50)', outlineOffset: 0,
      cursor: 'not-allowed', flexShrink: 0,
      boxShadow: '3px 3px 8px rgba(0,0,0,0.40)', fontFamily: FONT,
    }}>
      <Spinner color="#FFFFFF" />
      <span style={{ fontSize: 14, fontWeight: 400, color: '#FFFFFF', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

// ─── Danger ──────────────────────────────────────────────────────────────────

function DangerBtnInteractive({ label }) {
  return (
    <>
      <style>{`
        .btn-danger {
          display: flex; align-items: center; gap: 4px;
          height: 36px; padding: 0 16px; border-radius: 8px;
          background-color: #D13B3B;
          border: 1px solid rgba(255,255,255,0.20);
          outline: 1px solid rgba(0,0,0,0.50); outline-offset: 0;
          cursor: pointer; flex-shrink: 0; font-family: ${FONT};
        }
        .btn-danger:hover { background-color: #F75F5F; }
        .btn-danger:active { background-color: #D13B3B; }
      `}</style>
      <button className="btn-danger">
        <TrashIcon color="#FFFFFF" />
        <span style={{ fontSize: 14, fontWeight: 500, color: '#FFFFFF', whiteSpace: 'nowrap' }}>{label}</span>
      </button>
    </>
  )
}

function DangerBtnDisabled({ label }) {
  return (
    <button disabled style={{
      display: 'flex', alignItems: 'center', gap: 4,
      height: 36, padding: '0 16px', borderRadius: 8,
      backgroundColor: 'rgba(247,95,95,0.20)',
      border: '1px solid transparent',
      outline: '1px solid rgba(0,0,0,0.50)', outlineOffset: 0,
      cursor: 'not-allowed', flexShrink: 0, fontFamily: FONT,
    }}>
      <TrashIcon color="rgba(255,255,255,0.20)" />
      <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.20)', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

function DangerBtnLoading({ label }) {
  return (
    <button disabled style={{
      display: 'flex', alignItems: 'center', gap: 4,
      height: 36, padding: '0 16px', borderRadius: 8,
      backgroundColor: '#D13B3B',
      border: '1px solid rgba(255,255,255,0.20)',
      outline: '1px solid rgba(0,0,0,0.50)', outlineOffset: 0,
      cursor: 'not-allowed', flexShrink: 0, fontFamily: FONT,
    }}>
      <Spinner color="#FFFFFF" />
      <span style={{ fontSize: 14, fontWeight: 500, color: '#FFFFFF', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const VARIANTS = [
  {
    key: 'accent',   name: 'Accent',
    desc: '单层 · 品牌青色 · 表面渐变光感 · 每页最多 1–2 次',
    label: '开始生成',
    Interactive: AccentBtnInteractive,
    Disabled: AccentBtnDisabled,
    Loading: AccentBtnLoading,
  },
  {
    key: 'primary',  name: 'Primary',
    desc: '双层 · 渐变边框 · 深色填充 · 常规主操作',
    label: '确认',
    Interactive: PrimaryBtnInteractive,
    Disabled: PrimaryBtnDisabled,
    Loading: PrimaryBtnLoading,
  },
  {
    key: 'secondary', name: 'Secondary',
    desc: '单层 · 无渐变 · 共用 Primary Token · 视觉权重更低',
    label: '保存',
    Interactive: SecondaryBtnInteractive,
    Disabled: SecondaryBtnDisabled,
    Loading: SecondaryBtnLoading,
  },
  {
    key: 'danger',   name: 'Danger',
    desc: '单层 · 红色填充 · 不可逆危险操作',
    label: '删除',
    Interactive: DangerBtnInteractive,
    Disabled: DangerBtnDisabled,
    Loading: DangerBtnLoading,
  },
]

const COLS = [
  { key: 'interactive', label: '交互 Default / Hover / Active' },
  { key: 'disabled',    label: '禁用 Disabled' },
  { key: 'loading',     label: '加载 Loading' },
]

const COL_W = 200

export default function ButtonShowcase() {
  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{
        backgroundColor: '#111111', minHeight: '100vh',
        padding: '48px 56px', fontFamily: FONT,
      }}>
        <div style={{ marginBottom: 48 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
            Button
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.40)' }}>
            Large · 4 variants × 3 columns
          </p>
        </div>

        {/* Column headers */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, paddingLeft: 140 }}>
          {COLS.map(c => (
            <div key={c.key} style={{
              width: COL_W, flexShrink: 0,
              fontSize: 11, fontWeight: 500,
              color: 'rgba(255,255,255,0.25)',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              {c.label}
            </div>
          ))}
        </div>

        <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 32 }} />

        {VARIANTS.map((v, i) => (
          <div key={v.key} style={{
            display: 'flex', alignItems: 'center',
            marginBottom: i < VARIANTS.length - 1 ? 32 : 0,
          }}>
            <div style={{ width: 140, flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.80)', marginBottom: 2 }}>
                {v.name}
              </div>
              <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.25)', lineHeight: '16px' }}>
                {v.desc}
              </div>
            </div>

            <div style={{ width: COL_W, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <v.Interactive label={v.label} />
            </div>
            <div style={{ width: COL_W, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <v.Disabled label={v.label} />
            </div>
            <div style={{ width: COL_W, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <v.Loading label={v.label} />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

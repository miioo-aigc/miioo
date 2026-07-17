import { Button } from '../components/ui';

const FONT = "'Alibaba PuHuiTi 2.0', system-ui, sans-serif";

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const VARIANTS = [
  {
    key: 'accent',
    name: 'Accent',
    desc: '单层 · 品牌青色 · 表面渐变光感 · 每页最多 1–2 次',
    label: '开始生成',
    icon: <PlusIcon />,
  },
  {
    key: 'primary',
    name: 'Primary',
    desc: '双层 · 渐变边框 · 深色填充 · 常规主操作',
    label: '确认',
    icon: <PlusIcon />,
  },
  {
    key: 'secondary',
    name: 'Secondary',
    desc: '单层 · 无渐变 · 共用 Primary Token · 视觉权重更低',
    label: '保存',
    icon: <PlusIcon />,
  },
  {
    key: 'danger',
    name: 'Danger',
    desc: '单层 · 红色填充 · 不可逆危险操作',
    label: '删除',
    icon: <TrashIcon />,
  },
];

const COLS = [
  { key: 'interactive', label: '交互 Default / Hover / Active' },
  { key: 'disabled', label: '禁用 Disabled' },
  { key: 'loading', label: '加载 Loading' },
];

const COL_W = 200;

function ShowcaseButton({ variant, label, icon, state }) {
  return (
    <Button
      variant={variant}
      icon={icon}
      disabled={state === 'disabled'}
      loading={state === 'loading'}
      aria-label={`${label}${state === 'disabled' ? '（禁用）' : state === 'loading' ? '（加载中）' : ''}`}
    >
      {label}
    </Button>
  );
}

export default function ButtonShowcase() {
  return (
    <div
      style={{
        backgroundColor: '#111111',
        minHeight: '100vh',
        padding: '48px 56px',
        fontFamily: FONT,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ marginBottom: '48px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
          Button
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '14px', fontWeight: 400, color: 'rgba(255,255,255,0.40)' }}>
          Large · 4 variants × 3 columns
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', paddingLeft: '140px' }}>
        {COLS.map((column) => (
          <div
            key={column.key}
            style={{
              width: `${COL_W}px`,
              flexShrink: 0,
              fontSize: '11px',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.25)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {column.label}
          </div>
        ))}
      </div>

      <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: '32px' }} />

      {VARIANTS.map((variant, index) => (
        <div
          key={variant.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: index < VARIANTS.length - 1 ? '32px' : 0,
          }}
        >
          <div style={{ width: '140px', flexShrink: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.80)', marginBottom: '2px' }}>
              {variant.name}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 400, color: 'rgba(255,255,255,0.25)', lineHeight: '16px' }}>
              {variant.desc}
            </div>
          </div>

          {['interactive', 'disabled', 'loading'].map((state) => (
            <div key={state} style={{ width: `${COL_W}px`, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <ShowcaseButton variant={variant.key} label={variant.label} icon={variant.icon} state={state} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * @file CreationEmptyState.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   CreationEmptyState  无历史记录时的空态图标、布局和输入区定位
 *   EmptyIconShell / CreationEmptyIcon*  按生成类型展示空态图标
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   通过显式 props 接收生成类型、模型参数和页面回调
 *   通过 renderInputCard 接入页面内 InputCard，不引用 CreationPage 闭包
 *   不调用 API、Store、Toast 或生成请求
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-16  从 CreationPage.jsx 抽离空态图标和空历史输入区
 *   2026-08-07  空态输入卡接入配音取消回调，保留再次发送后的提示词并支持失败/取消恢复
 */

function EmptyIconShell({ children }) {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="cei-bg" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.12" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="cei-stroke" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.24" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="cei-icon" x1="18" y1="20" x2="46" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#B7C0CC" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="28" fill="url(#cei-bg)" />
      <rect x="4.5" y="4.5" width="55" height="55" rx="27.5" stroke="url(#cei-stroke)" />
      {children}
    </svg>
  );
}

function CreationEmptyIconImage() {
  return (
    <EmptyIconShell>
      {/* 图片边框 */}
      <rect x="17" y="21" width="30" height="23" rx="2.5" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.9" />
      {/* 太阳 */}
      <circle cx="23.5" cy="27.5" r="2.5" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.9" />
      {/* 山形折线 */}
      <path d="M17 38 L24 31 L29 36 L34 29 L47 40" stroke="url(#cei-icon)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.9" />
      {/* Sparkle */}
      <path d="M42 20L42.8 22.2L45 23L42.8 23.8L42 26L41.2 23.8L39 23L41.2 22.2L42 20Z" fill="#2DC3E1" fillOpacity="0.85" />
    </EmptyIconShell>
  );
}

function CreationEmptyIconVideo() {
  return (
    <EmptyIconShell>
      {/* 胶片外框 */}
      <rect x="17" y="22" width="30" height="21" rx="2.5" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.9" />
      {/* 顶部胶片孔横线 */}
      <line x1="17" y1="27" x2="47" y2="27" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      {/* 底部胶片孔横线 */}
      <line x1="17" y1="38" x2="47" y2="38" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      {/* 胶片孔 top */}
      <line x1="22" y1="22" x2="22" y2="27" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="28" y1="22" x2="28" y2="27" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="36" y1="22" x2="36" y2="27" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="42" y1="22" x2="42" y2="27" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      {/* 胶片孔 bottom */}
      <line x1="22" y1="38" x2="22" y2="43" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="28" y1="38" x2="28" y2="43" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="36" y1="38" x2="36" y2="43" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="42" y1="38" x2="42" y2="43" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      {/* 播放三角 */}
      <path d="M28.5 29.5 L28.5 35.5 L34.5 32.5 Z" stroke="url(#cei-icon)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.9" />
      {/* Sparkle */}
      <path d="M42 20L42.8 22.2L45 23L42.8 23.8L42 26L41.2 23.8L39 23L41.2 22.2L42 20Z" fill="#2DC3E1" fillOpacity="0.85" />
    </EmptyIconShell>
  );
}

function CreationEmptyIconDubbing() {
  return (
    <EmptyIconShell>
      {/* 麦克风主体 */}
      <rect x="27" y="18" width="10" height="16" rx="5" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.9" />
      {/* 麦克风支架弧线 */}
      <path d="M22 31 C22 37 42 37 42 31" stroke="url(#cei-icon)" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.9" />
      {/* 支架竖线 */}
      <line x1="32" y1="37" x2="32" y2="43" stroke="url(#cei-icon)" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.9" />
      {/* 底座横线 */}
      <line x1="27" y1="43" x2="37" y2="43" stroke="url(#cei-icon)" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.9" />
      {/* Sparkle */}
      <path d="M42 20L42.8 22.2L45 23L42.8 23.8L42 26L41.2 23.8L39 23L41.2 22.2L42 20Z" fill="#2DC3E1" fillOpacity="0.85" />
    </EmptyIconShell>
  );
}

function CreationEmptyIconMusic() {
  return (
    <EmptyIconShell>
      {/* 音符圆点 */}
      <ellipse cx="25" cy="34" rx="4" ry="3" fill="url(#cei-icon)" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.9" />
      <ellipse cx="38" cy="38" rx="4" ry="3" fill="url(#cei-icon)" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.9" />
      {/* 音符旗杆 */}
      <line x1="29" y1="34" x2="29" y2="20" stroke="url(#cei-icon)" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.9" />
      <line x1="42" y1="38" x2="42" y2="24" stroke="url(#cei-icon)" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.9" />
      {/* 音符旗帜 */}
      <path d="M29 20 L36 22.5 L29 25 Z" stroke="url(#cei-icon)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.9" />
      {/* Sparkle */}
      <path d="M42 16L42.8 18.2L45 19L42.8 19.8L42 22L41.2 19.8L39 19L41.2 18.2L42 16Z" fill="#2DC3E1" fillOpacity="0.85" />
    </EmptyIconShell>
  );
}

const EMPTY_ICON_MAP = {
  image: CreationEmptyIconImage,
  video: CreationEmptyIconVideo,
  dubbing: CreationEmptyIconDubbing,
  music: CreationEmptyIconMusic,
};

export default function CreationEmptyState({
  onGenerate,
  genType,
  onGenTypeChange,
  model,
  onModelChange,
  modelOptions,
  creationParams,
  onBeforeModelOpen,
  showToast,
  activeCount = 0,
  capabilitiesMap = {},
  isGenerating = false,
  onCancelGeneration,
  renderInputCard,
}) {
  const EmptyIcon = EMPTY_ICON_MAP[genType] ?? CreationEmptyIconImage;
  const inputDisabled = isGenerating && (genType === 'dubbing' || genType === 'music');
  const inputCardProps = {
    onGenerate,
    onCancelGeneration,
    disabled: inputDisabled,
    width: '100%',
    genType,
    onGenTypeChange,
    model,
    onModelChange,
    modelOptions,
    creationParams,
    onBeforeModelOpen,
    showToast,
    activeCount,
    capabilitiesMap,
  };

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        alignSelf: 'stretch',
        gap: '0px',
        position: 'relative',
      }}
    >
      {/* Center hint — fixed, centered in the space above InputCard */}
      <div
        style={{
          position: 'fixed',
          top: 'calc(50vh - 58px)',
          left: '50%',
          translate: '-50% -50%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.5,
        }}
      >
        <EmptyIcon />
      </div>
      {/* InputCard: absolute, centered horizontally, 16px from bottom */}
      <div style={{ position: 'absolute', left: '50%', bottom: '16px', translate: '-50% 0', width: 'min(800px, 100%)' }}>
        {renderInputCard?.(inputCardProps)}
      </div>
    </div>
  );
}

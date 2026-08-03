/**
 * @file SendButton.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   剧本发送、加载和暂停生成按钮
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 ScriptPage 抽离，保持发送/停止视觉和交互不变
 *   2026-07-21  按 Paper 设计稿恢复 40px 脉冲发送按钮视觉
 *   2026-07-21  独立管理默认、悬停、按下、禁用和暂停状态
 *   2026-08-03  将发送按钮阴影边界修正为圆形
 */
import { useState } from 'react';
import { PulsingBorder } from '@paper-design/shaders-react';
import DotsLoading from '../DotsLoading';

function SendButton({ onClick, disabled = false, loading = false, isGenerating = false, paused = false }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const isPaused = paused || isGenerating;
  const isClickable = isPaused || !disabled;
  const label = isPaused ? '暂停生成' : loading ? '正在发送剧本' : '发送剧本';

  return (
    <span
      title={disabled && !isPaused ? '不可用' : undefined}
      style={{
        display: 'inline-flex',
        width: '40px',
        height: '40px',
        flexShrink: 0,
        borderRadius: '999px',
        cursor: disabled && !isPaused ? 'not-allowed' : 'pointer',
      }}
    >
      <button
      type="button"
      aria-label={label}
      aria-disabled={!isClickable}
      disabled={!isClickable}
      onClick={isClickable ? onClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => isClickable && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: 'flex',
        width: '40px',
        height: '40px',
        minWidth: '40px',
        minHeight: '40px',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0px',
        position: 'relative',
        flexShrink: 0,
        borderRadius: '999px',
        boxShadow: '#2DC3E133 0px 0px 12px',
        cursor: 'inherit',
        transform: pressed ? 'scale(0.96)' : hovered && isClickable ? 'scale(1.05)' : 'scale(1)',
        transformOrigin: 'center',
        animation: hovered && isClickable ? 'send-button-hover-bounce 360ms ease-out' : 'none',
        transition: 'transform 180ms cubic-bezier(0.22, 1.35, 0.36, 1), opacity 150ms ease',
        opacity: 1,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        padding: 0,
      }}
    >
      <PulsingBorder
        speed={pressed ? 2 : 1}
        roundness={1}
        thickness={0.41}
        softness={1}
        intensity={0.4}
        bloom={0.68}
        spots={4}
        spotSize={0.42}
        pulse={0.37}
        smoke={0.55}
        smokeSize={0.18}
        scale={0.94}
        rotation={0}
        aspectRatio="square"
        frame={82693858.3483701}
        colors={['#0DC1FDB3', '#E1F5FF', '#73FFE1']}
        colorBack="#00000000"
        className="rounded-full flex-1 w-full h-full [box-shadow:#34DDFFB3_0px_0px_4px_2px_inset] bg-[#131313]"
      />
      {isPaused ? (
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%' }}>
          <rect x="4" y="3" width="3" height="10" rx="1.5" fill="white" />
          <rect x="9" y="3" width="3" height="10" rx="1.5" fill="white" />
        </svg>
      ) : loading ? (
        <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%' }}>
          <DotsLoading size={4} color="#FFFFFF" gap={3} />
        </div>
      ) : (
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%' }}>
          <path d="M8.003 4.7V14" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 8.667L8 4.667L12 8.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 2H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      </button>
      <style>{`@keyframes send-button-hover-bounce {
        0% { transform: scale(1); }
        55% { transform: scale(1.07); }
        100% { transform: scale(1.05); }
      }`}</style>
    </span>
  );
}

export default SendButton;

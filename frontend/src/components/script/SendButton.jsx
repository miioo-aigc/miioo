/**
 * @file SendButton.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   剧本发送、加载和停止生成按钮
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 ScriptPage 抽离，保持发送/停止视觉和交互不变
 */
import { useState } from 'react';
import { PulsingBorder } from '@paper-design/shaders-react';
import DotsLoading from '../DotsLoading';
import { IconButton } from '../ui';

function SendButton({ onClick, disabled = false, loading = false, isGenerating = false }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isClickable = isGenerating || !disabled;
  const scale = pressed ? 'scale(0.9)' : hovered ? 'scale(1.1)' : 'scale(1)';

  return (
    <IconButton
      size="large"
      variant="secondary"
      aria-label={isGenerating ? '停止生成' : loading ? '正在发送剧本' : '发送剧本'}
      disabled={!isClickable}
      onMouseEnter={() => isClickable && setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => isClickable && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={isClickable ? onClick : undefined}
      contentClassName="!relative !h-full !w-full !rounded-full !p-0"
      className="!h-[40px] !w-[40px] !rounded-full !p-0 !shadow-none"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0px',
        position: 'relative',
        flexShrink: 0,
        boxShadow: '#2DC3E133 0px 0px 12px',
        cursor: !isClickable ? 'not-allowed' : 'pointer',
        transform: !isClickable ? 'scale(1)' : scale,
        transition: 'transform 0.15s cubic-bezier(0.4,0,0.2,1), opacity 0.15s',
        opacity: (!isClickable) ? 0.45 : 1,
        background: 'transparent',
        border: 'none',
        outline: 'none',
      }}
    >
      <PulsingBorder
        speed={loading ? 1.3 : 1}
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
        frame={34362983.25087259}
        colors={['#0DC1FDB3', '#E1F5FF', '#73FFE1']}
        colorBack="#00000000"
        className="rounded-full flex-1 w-full [box-shadow:#34DDFFB3_0px_0px_4px_2px_inset] bg-neutral-300"
      />
      {isGenerating ? (
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
    </IconButton>
  );
}

export default SendButton;

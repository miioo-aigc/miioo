/**
 * @file CreationSendButton.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   创作输入区圆形发送按钮、加载动画、禁用提示和交互反馈
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只通过 onClick、disabled、loading、cancelable 和 disabledTooltip 接收页面状态
 *   复用 components/ui/Button；不引用页面、API、Store 或生成编排
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-16  从 CreationPage.jsx 抽离
 *   2026-08-07  配音生成中允许再次点击按钮停止当前请求
 *   2026-08-11  移除点击后额外焦点外圈，保留发送按钮原有流光特效
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PulsingBorder } from '@paper-design/shaders-react';
import { Button } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const THINKING_STYLE_ID = 'creation-thinking-style';

function ensureThinkingStyle() {
  if (document.getElementById(THINKING_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = THINKING_STYLE_ID;
  style.textContent = `
    @keyframes creation-thinking-dot {
      0%, 60%, 100% { opacity: 0.2; transform: translateY(0px); }
      30% { opacity: 1; transform: translateY(-4px); }
    }
    .creation-thinking-dot { animation: creation-thinking-dot 1.4s ease-in-out infinite; }
    .creation-thinking-dot:nth-child(1) { animation-delay: 0s; }
    .creation-thinking-dot:nth-child(2) { animation-delay: 0.2s; }
    .creation-thinking-dot:nth-child(3) { animation-delay: 0.4s; }
  `;
  document.head.appendChild(style);
}

export default function CreationSendButton({ onClick, disabled = false, loading = false, cancelable = false, disabledTooltip = '' }) {
  const isDisabled = disabled && !cancelable;
  const isCancelable = cancelable && loading;
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [tooltipRect, setTooltipRect] = useState(null);
  const wrapRef = useRef(null);
  const scale = pressed ? 'scale(0.9)' : hovered ? 'scale(1.1)' : 'scale(1)';

  useEffect(() => {
    ensureThinkingStyle();
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0, display: 'inline-flex' }}
      onMouseEnter={() => {
        setHovered(true);
        if (isDisabled && disabledTooltip && wrapRef.current) {
          setTooltipRect(wrapRef.current.getBoundingClientRect());
        }
      }}
      onMouseLeave={() => { setHovered(false); setPressed(false); setTooltipRect(null); }}
    >
      {isDisabled && hovered && disabledTooltip && tooltipRect && createPortal(
        <div style={{
          position: 'fixed',
          zIndex: 9999,
          background: '#2A2B2B',
          border: '1px solid #FFFFFF14',
          borderRadius: '8px',
          padding: '8px 12px',
          maxWidth: '180px',
          fontFamily: FONT,
          fontSize: '12px',
          lineHeight: '18px',
          color: '#FFFFFFCC',
          pointerEvents: 'none',
          boxShadow: '0 4px 16px #00000066',
          left: Math.min(
            Math.max(8, tooltipRect.left + tooltipRect.width / 2 - 90),
            window.innerWidth - 8 - 180
          ),
          bottom: window.innerHeight - tooltipRect.top + 8,
        }}>
          {disabledTooltip}
        </div>,
        document.body
      )}
      <Button
        type="button"
        variant="accent"
        size="large"
        iconOnly
        disabled={isDisabled}
        aria-label={isCancelable ? '停止配音创作' : '发送创作请求'}
        onMouseEnter={() => !isDisabled && setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false); }}
        onMouseDown={() => !isDisabled && setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onClick={isDisabled ? undefined : onClick}
        className="!w-10 !h-10 !min-w-0 !rounded-full !p-0 !bg-transparent !border-0 !shadow-none"
        contentClassName="!w-full !h-full !min-w-0 !rounded-full !p-0 !bg-transparent !text-transparent"
        style={{
          borderRadius: '9999px',
          position: 'relative',
          flexShrink: 0,
          boxShadow: '#2DC3E133 0px 0px 12px',
          width: '40px',
          height: '40px',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          transform: isDisabled ? 'scale(1)' : scale,
          transition: 'transform 0.15s cubic-bezier(0.4,0,0.2,1), opacity 0.15s',
          opacity: isDisabled ? 0.45 : isCancelable ? 0.82 : 1,
          background: 'transparent',
          backgroundImage: 'none',
          border: 'none',
          outline: 'none',
          padding: 0,
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
          className="rounded-full flex-1 w-full h-full [box-shadow:#34DDFFB3_0px_0px_4px_2px_inset] bg-neutral-300"
        />
        {isCancelable ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"
            style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%' }}>
            <rect x="5" y="5" width="8" height="8" rx="1" fill="#FFFFFF" />
          </svg>
        ) : loading ? (
          <div style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%', display: 'flex', alignItems: 'center', gap: '3px' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="creation-thinking-dot" style={{ width: '4px', height: '4px', borderRadius: '9999px', background: '#FFFFFF' }} />
            ))}
          </div>
        ) : (
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
            style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%' }}>
            <path d="M8.003 4.7V14" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 8.667L8 4.667L12 8.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 2H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </Button>
    </div>
  );
}

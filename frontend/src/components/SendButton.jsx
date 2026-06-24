import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { PulsingBorder } from '@paper-design/shaders-react';
import { FONT } from '../utils/fonts';

const THINKING_STYLE_ID = 'creation-thinking-style';

function ensureThinkingStyle() {
  if (document.getElementById(THINKING_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = THINKING_STYLE_ID;
  style.textContent = `
    .creation-thinking-dot {
      animation: creation-thinking-bounce 0.8s infinite alternate;
    }
    .creation-thinking-dot:nth-child(2) { animation-delay: 0.2s; }
    .creation-thinking-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes creation-thinking-bounce {
      from { transform: translateY(0); opacity: 0.4; }
      to { transform: translateY(-3px); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

function SendButton({ onClick, disabled = false, loading = false, disabledTooltip = '' }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tooltipRect, setTooltipRect] = useState(null);
  const wrapRef = useRef(null);
  const scale = pressed ? 'scale(0.9)' : hovered ? 'scale(1.1)' : 'scale(1)';

  useEffect(() => { ensureThinkingStyle(); }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0, display: 'inline-flex' }}
      onMouseEnter={() => {
        setHovered(true);
        if (disabled && disabledTooltip && wrapRef.current) {
          setTooltipRect(wrapRef.current.getBoundingClientRect());
        }
      }}
      onMouseLeave={() => { setHovered(false); setPressed(false); setTooltipRect(null); }}
    >
      {disabled && hovered && disabledTooltip && tooltipRect && createPortal(
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
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '9999px',
        position: 'relative',
        flexShrink: 0,
        boxShadow: '#2DC3E133 0px 0px 12px',
        width: '40px',
        height: '40px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transform: disabled ? 'scale(1)' : scale,
        transition: 'transform 0.15s cubic-bezier(0.4,0,0.2,1), opacity 0.15s',
        opacity: disabled ? 0.45 : 1,
        background: 'transparent',
        border: 'none',
        outline: focused ? '1px solid #2DC3E180' : 'none',
        outlineOffset: '4px',
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
        className="rounded-full flex-1 w-full [box-shadow:#34DDFFB3_0px_0px_4px_2px_inset] bg-neutral-300"
      />
      {loading ? (
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
    </button>
    </div>
  );
}

export default memo(SendButton);

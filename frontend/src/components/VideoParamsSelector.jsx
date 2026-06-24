import { useState, useEffect, useRef, memo } from 'react';
import { FONT } from '../utils/fonts';
import RatioIcon from './RatioIcon';

function VideoParamsSelector({ ratio, resolution, duration, onRatioChange, onResolutionChange, onDurationChange, disabled,
  ratioOptions = [], resolutionOptions = [], durationOptions = [] }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isActive = open || hovered;

  const dropdownRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const cellStyle = (selected) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '8px',
    paddingBottom: '8px',
    borderRadius: '4px',
    width: 'calc(25% - 3px)',
    cursor: 'pointer',
    border: 'none',
    fontFamily: FONT,
    fontSize: '12px',
    lineHeight: '16px',
    color: selected ? '#FFFFFF' : '#FFFFFF66',
    background: selected ? '#FFFFFF14' : '#FFFFFF0D',
    boxShadow: selected ? '#FFFFFF33 0px 0px 0px 1px inset' : 'none',
    transition: 'background 0.15s, box-shadow 0.15s',
    flexShrink: 0,
  });

  const simpleCellStyle = (selected) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '8px',
    paddingBottom: '8px',
    borderRadius: '4px',
    width: 'calc(25% - 3px)',
    cursor: 'pointer',
    border: 'none',
    fontFamily: FONT,
    fontSize: '12px',
    lineHeight: '16px',
    color: selected ? '#FFFFFF' : '#FFFFFF66',
    background: selected ? '#FFFFFF14' : '#FFFFFF0D',
    boxShadow: selected ? '#FFFFFF33 0px 0px 0px 1px inset' : 'none',
    transition: 'background 0.15s, box-shadow 0.15s',
    flexShrink: 0,
  });

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onMouseEnter={() => !disabled && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          height: '32px',
          paddingLeft: '12px',
          paddingRight: '6px',
          borderRadius: '8px',
          justifyContent: 'space-between',
          flexShrink: 0,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          cursor: 'pointer',
          background: 'rgb(29, 30, 30)',
          outline: 'rgba(0, 0, 0, 0.5) solid 1px',
          boxShadow: 'none',
          transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
          opacity: 1,
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <RatioIcon rw={ratioOptions.find((r) => r.value === ratio)?.w ?? 16} rh={ratioOptions.find((r) => r.value === ratio)?.h ?? 9} selected />
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC' }}>{ratio}</span>
        </div>
        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC' }}>{resolution}</span>
        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC' }}>{duration}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          zIndex: 50,
          left: 0,
          bottom: 'calc(100% + 4px)',
          borderRadius: '8px',
          background: '#1D1E1E',
          border: '1px solid #FFFFFF0D',
          boxShadow: '0px 4px 16px #00000066',
          width: '320px',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {/* 比例 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF66' }}>比例</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {ratioOptions.map((opt) => {
                const sel = opt.value === ratio;
                return (
                  <button key={opt.value} type="button" style={cellStyle(sel)}
                    onClick={() => { onRatioChange(opt.value); }}
                    onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = '#FFFFFF14'; }}
                    onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = '#FFFFFF0D'; }}
                  >
                    <RatioIcon rw={opt.w} rh={opt.h} selected={sel} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 分辨率 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF66' }}>分辨率</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {resolutionOptions.map((opt) => {
                const sel = opt === resolution;
                return (
                  <button key={opt} type="button" style={simpleCellStyle(sel)}
                    onClick={() => { onResolutionChange(opt); }}
                    onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = '#FFFFFF14'; }}
                    onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = '#FFFFFF0D'; }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 时长 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF66' }}>时长</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {durationOptions.map((opt) => {
                const sel = opt === duration;
                return (
                  <button key={opt} type="button" style={simpleCellStyle(sel)}
                    onClick={() => { onDurationChange(opt); }}
                    onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = '#FFFFFF14'; }}
                    onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = '#FFFFFF0D'; }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(VideoParamsSelector);

import { useEffect, useRef, useState } from 'react';
import { RatioIcon, FONT } from './CreationSelectorPrimitives';

// ─── Video params selector (ratio + resolution + duration) ────────────────────
export function VideoParamsSelector({ ratio, resolution, duration, onRatioChange, onResolutionChange, onDurationChange, disabled,
  ratioOptions = [], resolutionOptions = [], durationOptions = [], resolutionRatios = {},
  soundEnabled = true, onSoundChange }) {
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

  // Filter options by resolutionRatios: only show combos that are valid.
  // 空分辨率映射（resolutionRatios[res] 为 []）表示「该分辨率不限制比例」，放行全部比例，
  // 否则会把所有比例错误地过滤成空白（新接入模型常为空 resolution_size_map）。
  const ratioAllowed = (res, value) => {
    const allowed = resolutionRatios[res];
    if (!res || !Array.isArray(allowed) || allowed.length === 0) return true;
    return allowed.includes(value);
  };
  const filteredRatioOpts = ratioOptions.filter(opt => ratioAllowed(resolution, opt.value));
  const filteredResolutionOpts = resolutionOptions.filter(res => ratioAllowed(res, ratio));

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
          border: '1px solid',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: open ? '#252525' : isActive ? '#222222' : '#1D1E1E',
          borderColor: open ? '#2DC3E199' : '#FFFFFF14',
          outline: '1px solid #00000080',
          boxShadow: open ? '#2DC3E11A 0px 0px 10px' : 'none',
          transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
          opacity: disabled ? 0.45 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <RatioIcon rw={ratioOptions.find((r) => r.value === ratio)?.w ?? 16} rh={ratioOptions.find((r) => r.value === ratio)?.h ?? 9} selected />
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC' }}>{ratio}</span>
        </div>
        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC' }}>{resolution}</span>
        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC' }}>{duration}</span>
        {soundEnabled ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <path d="M2 5.5H4.5L8 2.5V13.5L4.5 10.5H2V5.5Z" stroke="#FFFFFFCC" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
            <path d="M10.5 5.5C11.5 6.2 12 7 12 8C12 9 11.5 9.8 10.5 10.5" stroke="#FFFFFFCC" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
            <path d="M12 3.5C13.8 4.8 14.5 6.3 14.5 8C14.5 9.7 13.8 11.2 12 12.5" stroke="#FFFFFFCC" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <path d="M2 5.5H4.5L8 2.5V13.5L4.5 10.5H2V5.5Z" stroke="#FFFFFF66" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
            <line x1="10" y1="5.5" x2="14.5" y2="10.5" stroke="#FFFFFF66" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="14.5" y1="5.5" x2="10" y2="10.5" stroke="#FFFFFF66" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        )}
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
              {filteredRatioOpts.map((opt) => {
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
              {filteredResolutionOpts.map((opt) => {
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

          {/* 生成音频 */}
          {onSoundChange && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF66' }}>生成音频</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[{ label: '开启', value: true }, { label: '关闭', value: false }].map(({ label, value }) => {
                  const sel = soundEnabled === value;
                  return (
                    <button key={label} type="button"
                      style={{
                        ...simpleCellStyle(sel),
                        width: 'calc(50% - 2px)',
                      }}
                      onClick={() => { onSoundChange(value); }}
                      onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = '#FFFFFF14'; }}
                      onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = '#FFFFFF0D'; }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
